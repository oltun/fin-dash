from pydantic import BaseModel

class WatchlistCreate(BaseModel):
    symbol: str

class WatchlistOut(BaseModel):
    id: int
    symbol: str

    class Config:
        orm_mode = True
