from fastapi import APIRouter, Query

from app import search_lib

router = APIRouter()


@router.get("/search/huggingface")
async def search_huggingface(q: str = Query(..., min_length=1)):
    return await search_lib.search_hf(q)


@router.get("/search/civitai")
async def search_civitai(q: str = Query(..., min_length=1), nsfw: bool = False):
    return await search_lib.search_civitai(q, nsfw)
