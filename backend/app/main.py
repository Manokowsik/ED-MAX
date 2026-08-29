from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin
from app.routers import students
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.courses import router as courses_router
from app.routers.modules import router as modules_router
from app.routers.quizzes import router as quizzes_router
from app.routers.certificates import router as certificates_router


app = FastAPI(
    title="Training Platform API"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routers
# ============================================================

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(modules_router)
app.include_router(quizzes_router)
app.include_router(certificates_router)
app.include_router(admin.router)
app.include_router(students.router)


# ============================================================
# Root
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Training Platform API is running"
    }