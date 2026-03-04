import React, { useEffect, useRef } from 'react';
import { User, Appointment, Message } from '../types';
import { storageService } from '../services/storageService';

interface NotificationManagerProps {
    currentUser: User;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ currentUser }) => {
    const notifiedAppIds = useRef<Set<string>>(new Set());
    const notifiedMsgIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Request permission on mount
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const checkNotifications = async () => {
            if (Notification.permission !== 'granted') return;

            try {
                const now = new Date();
                const [appointments, messages] = await Promise.all([
                    storageService.getAppointments(),
                    storageService.getMessages()
                ]);

                // 1. Check Appointments (1 hour before)
                appointments.forEach(app => {
                    // Filter for current user (or if manager, maybe team? stick to personal for now)
                    // The user said "Team Management", so maybe they want to know about team appointments?
                    // Usually notifications are personal. Let's stick to "My Appointments" or "My Team's Appointments" if manager.
                    // For safety/noise reduction, let's notify if the user is the owner OR the manager of the owner.
                    // But simpler: Notify if userId matches currentUser.id
                    
                    // Actually, let's check if the user is involved.
                    // If the user is a manager, they might want to know about their team.
                    // But let's start with direct ownership to avoid spam.
                    if (app.userId !== currentUser.id) return;

                    const appDate = new Date(app.date);
                    if (isNaN(appDate.getTime())) return;

                    const timeDiff = appDate.getTime() - now.getTime();
                    const minutesDiff = timeDiff / (1000 * 60);

                    // Trigger if within 65 minutes (approx 1 hour window)
                    // And not yet notified
                    if (minutesDiff > 0 && minutesDiff <= 65 && !notifiedAppIds.current.has(app.id)) {
                        const timeString = appDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                        new Notification(`Sắp diễn ra: ${app.customerName}`, {
                            body: `Cuộc hẹn lúc ${timeString} với ${app.customerName}`,
                            icon: '/vite.svg', // Fallback icon
                            tag: `app-${app.id}` // Prevent duplicates via browser tag
                        });
                        notifiedAppIds.current.add(app.id);
                    }
                });

                // 2. Check Unread Messages
                messages.forEach(msg => {
                    // Check if message is for this user
                    const isForUser = msg.receiverId === 'ALL' || msg.receiverId === currentUser.id || (Array.isArray(msg.receiverId) && msg.receiverId.includes(currentUser.id));
                    
                    if (isForUser && !msg.isRead && !notifiedMsgIds.current.has(msg.id)) {
                        // Check if message is recent (e.g., within last 24 hours) to avoid spamming old unread messages on login
                        const msgDate = new Date(msg.timestamp);
                        const ageInHours = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
                        
                        if (ageInHours < 24) {
                            new Notification(`Tin nhắn mới từ ${msg.senderName}`, {
                                body: msg.content,
                                icon: '/vite.svg',
                                tag: `msg-${msg.id}`
                            });
                            notifiedMsgIds.current.add(msg.id);
                        }
                    }
                });

            } catch (error) {
                console.error("Notification check failed", error);
            }
        };

        // Initial check
        checkNotifications();

        // Interval check (every 1 minute)
        const intervalId = setInterval(checkNotifications, 60000);

        return () => clearInterval(intervalId);
    }, [currentUser]);

    return null; // Headless component
};
