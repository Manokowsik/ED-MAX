from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.database import get_connection
from app.schemas.profile import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ProfileUpdateRequest,
)
from app.services.notification_service import NotificationService
from app.services.profile_service import ProfileService


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


# ============================================================
# Profile Management (Self-Service: Current Authenticated User)
# ============================================================

@router.get("/me")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Retrieve the profile of the currently authenticated user."""
    conn = get_connection()
    try:
        profile = ProfileService.get_profile(conn, current_user["id"])
        return {"user": profile}
    finally:
        conn.close()


@router.patch("/me")
def update_my_profile(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update profile details (e.g. name) for the authenticated user."""
    conn = get_connection()
    try:
        profile = ProfileService.update_profile(conn, current_user, data.name)
        return {
            "message": "Profile updated successfully",
            "user": profile
        }
    finally:
        conn.close()


@router.post("/me/change-password")
def change_my_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """Change password for authenticated user while logged in."""
    conn = get_connection()
    try:
        return ProfileService.change_password(
            conn,
            current_user=current_user,
            current_password=data.current_password,
            new_password=data.new_password,
            confirm_password=data.confirm_password,
        )
    finally:
        conn.close()


@router.delete("/me")
def delete_my_account(
    data: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user)
):
    """Safely deactivate own account with confirmation and password verification."""
    conn = get_connection()
    try:
        return ProfileService.delete_account(
            conn,
            current_user=current_user,
            confirmation=data.confirmation,
            current_password=data.current_password,
        )
    finally:
        conn.close()


# ============================================================
# Notifications (Current Authenticated User)
# ============================================================

@router.get("/me/notifications")
def get_my_notifications(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Fetch notifications and unread count for current user."""
    conn = get_connection()
    try:
        items = NotificationService.list_for_user(conn, current_user["id"], limit=limit)
        unread = NotificationService.unread_count(conn, current_user["id"])
        return {
            "notifications": items,
            "unread_count": unread
        }
    finally:
        conn.close()


@router.patch("/me/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Mark a specific notification as read."""
    conn = get_connection()
    try:
        updated = NotificationService.mark_read(conn, current_user["id"], notification_id)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        return {
            "message": "Notification marked as read",
            "notification": updated
        }
    finally:
        conn.close()


@router.post("/me/notifications/read-all")
def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read for current user."""
    conn = get_connection()
    try:
        count = NotificationService.mark_all_read(conn, current_user["id"])
        return {
            "message": "All notifications marked as read",
            "marked_count": count
        }
    finally:
        conn.close()