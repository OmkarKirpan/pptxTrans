import { StateCreator } from 'zustand'
import type { NotificationsState, CommentNotification } from '../types'

export const createNotificationsSlice: StateCreator<NotificationsState> = (set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification: CommentNotification) => 
    set(state => {
      const newNotifications = [...state.notifications, notification]
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.isRead).length
      }
    }),
  
  markAsRead: (notificationId: string) => 
    set(state => {
      const newNotifications = state.notifications.map(n => 
        n.commentId === notificationId ? { ...n, isRead: true } : n
      )
      return {
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.isRead).length
      }
    }),
  
  markAllAsRead: () => 
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
    })),
  
  clearNotifications: () => 
    set({ notifications: [], unreadCount: 0 }),
}) 