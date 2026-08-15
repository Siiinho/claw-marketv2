"""Resolve mercadologia e imagem de produto por GTIN/EAN.

A mercadologia configurada e o código de barras são a fonte de verdade. A busca de
imagem nunca altera código, preço ou setor. O Google Custom Search é apenas um
fallback opcional e exige GOOGLE_CSE_API_KEY e GOOGLE_CSE_CX na Vercel.
"""

from __future__ import annotations

import base64
import json
import os
import re
from functools import lru_cache
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


CATALOGO = Path(__file__).resolve().parents[1] / "src" / "data" / "catalogoMercadologiaBengala.json"
MAX_IMAGEM_BYTES = 2_500_000
USER_AGENT = "ClawMarket/1.0 (+catalogo de ofertas internas)"
CATALOGOS_PUBLICOS = (
    ("open-food-facts", "Open Food Facts", "world.openfoodfacts.org"),
    ("open-products-facts", "Open Products Facts", "world.openproductsfacts.org"),
    ("open-beauty-facts", "Open Beauty Facts", "world.openbeautyfacts.org"),
    ("open-pet-food-facts", "Open Pet Food Facts", "world.openpetfoodfacts.org"),
)


def somente_digitos(valor: Any) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def codigo_comparavel(valor: Any) -> str:
    return somente_digitos(valor).lstrip("0") or "0"


@lru_cache(maxsize=1)
def mercadologia_por_codigo() -> dict[str, dict[str, Any]]:
    with CATALOGO.open("r", encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
    return {str(item["codigoBarras"]): item for item in dados.get("produtos", [])}


def produto_bengala(codigo: str) -> dict[str, Any] | None:
    catalogo = mercadologia_por_codigo()
    return catalogo.get(codigo) or catalogo.get(codigo.zfill(13))


def obter_json(url: str, timeout: int = 8) -> dict[str, Any] | None:
    requisicao = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(requisicao, timeout=timeout) as resposta:
            if resposta.status != 200:
                return None
            return json.loads(resposta.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def imagem_frontal(produto: dict[str, Any]) -> str | None:
    selecionada = produto.get("selected_images", {}).get("front", {}).get("display", {})
    url = (
        selecionada.get("pt")
        or selecionada.get("pt-br")
        or selecionada.get("en")
        or next(iter(selecionada.values()), None)
        or produto.get("image_front_url")
        or produto.get("image_url")
    )
    if not url:
        return None
    return re.sub(r"\.(?:100|200|400)\.jpg(?:\?.*)?$", ".full.jpg", url, flags=re.I)


def buscar_imagem_catalogo(codigo: str) -> dict[str, Any] | None:
    campos = ",".join((
        "code", "product_name", "product_name_pt", "brands", "brand_owner",
        "quantity", "image_front_url", "image_url", "selected_images",
    ))
    for origem, origem_nome, dominio in CATALOGOS_PUBLICOS:
        endpoint = f"https://{dominio}/api/v2/product/{codigo}.json?" + urlencode({
            "fields": campos, "lc": "pt", "cc": "br",
        })
        resposta = obter_json(endpoint)
        produto = resposta.get("product") if resposta and resposta.get("status") == 1 else None
        if not produto or codigo_comparavel(produto.get("code")) != codigo_comparavel(codigo):
            continue
        imagem = imagem_frontal(produto)
        if not imagem:
            continue
        return {
            "url": imagem,
            "paginaUrl": f"https://{dominio}/product/{codigo}",
            "origem": origem,
            "origemNome": origem_nome,
            "correspondencia": "codigo-exato",
            "nomeCatalogo": produto.get("product_name_pt") or produto.get("product_name") or "",
            "marca": (produto.get("brands") or produto.get("brand_owner") or "").split(",")[0].strip(),
            "fundoTransparente": False,
        }
    return None


def buscar_imagem_google(codigo: str, produto: dict[str, Any] | None) -> dict[str, Any] | None:
    chave = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    mecanismo = os.environ.get("GOOGLE_CSE_CX", "").strip()
    if not chave or not mecanismo:
        return None
    nome = (produto or {}).get("nome", "")
    consulta = " ".join(
        parte for parte in (codigo, nome, "produto embalagem packshot fundo transparente png") if parte
    ).strip()
    endpoint = "https://customsearch.googleapis.com/customsearch/v1?" + urlencode({
        "key": chave,
        "cx": mecanismo,
        "q": consulta,
        "searchType": "image",
        "imgColorType": "trans",
        "imgSize": "large",
        "fileType": "png",
        "safe": "active",
        "gl": "br",
        "hl": "pt-BR",
        "num": 5,
    })
    resposta = obter_json(endpoint, timeout=10) or {}
    for item in resposta.get("items", []):
        url = item.get("link")
        metadados = item.get("image", {})
        contexto = metadados.get("contextLink")
        largura = int(metadados.get("width") or 0)
        altura = int(metadados.get("height") or 0)
        if max(largura, altura) < 700:
            continue
        if url and urlparse(url).scheme in {"http", "https"}:
            return {
                "url": url,
                "paginaUrl": contexto,
                "origem": "google-custom-search",
                "origemNome": "Google Imagens",
                "correspondencia": "busca-por-codigo-e-nome",
                "nomeCatalogo": item.get("title", ""),
                "marca": "",
                "fundoTransparente": True,
                "termoBusca": consulta,
                "largura": largura,
                "altura": altura,
            }
    return None


def baixar_imagem(url: str) -> tuple[str | None, str | None]:
    requisicao = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/avif,image/webp,image/png,image/jpeg"})
    try:
        with urlopen(requisicao, timeout=12) as resposta:
            tipo = resposta.headers.get_content_type()
            if tipo not in {"image/jpeg", "image/png", "image/webp", "image/avif"}:
                return None, None
            tamanho = int(resposta.headers.get("Content-Length") or 0)
            if tamanho > MAX_IMAGEM_BYTES:
                return None, None
            conteudo = resposta.read(MAX_IMAGEM_BYTES + 1)
            if not conteudo or len(conteudo) > MAX_IMAGEM_BYTES:
                return None, None
            return f"data:{tipo};base64,{base64.b64encode(conteudo).decode('ascii')}", tipo
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None, None


@lru_cache(maxsize=256)
def resolver_produto(codigo: str) -> dict[str, Any]:
    produto = produto_bengala(codigo)
    # Quando o mecanismo Google está configurado, prioriza packshots grandes em
    # PNG transparente. Os catálogos exatos continuam como fallback confiável.
    imagem = buscar_imagem_google(codigo, produto) or buscar_imagem_catalogo(codigo)
    if imagem:
        imagem_data_url, mime = baixar_imagem(imagem["url"])
        imagem["dataUrl"] = imagem_data_url
        imagem["mime"] = mime
        imagem["baixadaNoBackend"] = bool(imagem_data_url)
    return {
        "encontrado": bool(produto or imagem),
        "codigoBarras": (produto or {}).get("codigoBarras", codigo),
        "produto": produto,
        "imagem": imagem,
        "fonteMercadologia": "Catálogo mercadológico configurado" if produto else None,
        "googleConfigurado": bool(os.environ.get("GOOGLE_CSE_API_KEY") and os.environ.get("GOOGLE_CSE_CX")),
    }


class handler(BaseHTTPRequestHandler):
    def _cabecalhos(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self._cabecalhos(204)

    def do_GET(self) -> None:
        parametros = parse_qs(urlparse(self.path).query)
        codigo = somente_digitos((parametros.get("codigo") or [""])[0])
        if not 4 <= len(codigo) <= 14:
            self._cabecalhos(400)
            self.wfile.write(json.dumps({"error": "Informe um código de barras válido."}).encode("utf-8"))
            return
        try:
            resultado = resolver_produto(codigo)
            self._cabecalhos(200 if resultado["encontrado"] else 404)
            self.wfile.write(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        except Exception:
            self._cabecalhos(502)
            self.wfile.write(json.dumps({"error": "Não foi possível consultar o catálogo agora."}).encode("utf-8"))
