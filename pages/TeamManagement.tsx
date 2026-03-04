import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Appointment, Consultation, Revenue, MonthlyTarget, ROLE_RANK, Department, ROLE_LABELS } from '../types';
import { storageService } from '../services/storageService';
import { Loader2, Calendar as CalendarIcon, Users, DollarSign, Target, ChevronLeft, ChevronRight, Settings, Filter, Eye, X, Bell, Clock, User as UserIcon, FileText, Phone, MapPin, FileType } from 'lucide-react';
import { Card, Button, Select, Modal, Badge } from '../components/ui';

interface TeamManagementProps {
    currentUser: User;
    onBack: () => void;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ currentUser, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [subordinates, setSubordinates] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [revenues, setRevenues] = useState<Revenue[]>([]);
    const [targets, setTargets] = useState<MonthlyTarget[]>([]);
    
    // UI State
    const [visibleColumns, setVisibleColumns] = useState({
        stt: true,
        id: true,
        name: true,
        joinDate: false,
        role: false,
        target: true,
        revenue: true,
        appointments: true,
        consultations: true,
        todayRevenue: true,
        todayAppointments: true,
        todayConsultations: true
    });
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<string | null>(null);
    const [selectedDateForDayDetail, setSelectedDateForDayDetail] = useState<string | null>(null);
    
    // Target Editing State
    const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
    const [tempTargetValue, setTempTargetValue] = useState<string>('');

    // Reminders State
    const [reminders, setReminders] = useState<any[]>([]);
    const [showReminders, setShowReminders] = useState(false);

    // Tooltip State
    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, content: React.ReactNode } | null>(null);

    // Month Selection (YYYY-MM)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const currentTeamName = useMemo(() => {
        if (!currentUser.departmentId) return 'Chưa phân bổ';
        const dept = departments.find(d => d.id === currentUser.departmentId);
        return dept ? dept.name : 'Team';
    }, [currentUser.departmentId, departments]);

    // Handle Target Save
    const handleSaveTarget = async (userId: string) => {
        try {
            const numValue = parseInt(tempTargetValue.replace(/\D/g, ''), 10) || 0;
            const targetId = `${userId}_${selectedMonth.replace(/-/g, '_')}`;
            
            // Find existing target to preserve other values or create new
            const existingTarget = targets.find(t => t.userId === userId && t.monthStr === selectedMonth);
            
            const newTarget: MonthlyTarget = {
                id: targetId,
                userId: userId,
                monthStr: selectedMonth,
                targetRevenue: numValue,
                targetAppointment: existingTarget?.targetAppointment || 0,
                targetConsultation: existingTarget?.targetConsultation || 0
            };

            await storageService.saveMonthlyTarget(newTarget);
            
            // Update local state
            setTargets(prev => {
                const idx = prev.findIndex(t => t.id === targetId);
                if (idx >= 0) {
                    const newTargets = [...prev];
                    newTargets[idx] = newTarget;
                    return newTargets;
                } else {
                    return [...prev, newTarget];
                }
            });
            
            setEditingTargetId(null);
        } catch (error) {
            console.error("Failed to save target", error);
            alert("Lỗi khi lưu cam kết");
        }
    };

    // Check Reminders
    useEffect(() => {
        if (loading || appointments.length === 0) return;

        const check = () => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // YYYY-MM-DD
            const currentHour = now.getHours();
            
            let newReminders: any[] = [];

            // 1. 1 Hour Before Reminder
            appointments.forEach(app => {
                if (!subordinates.some(u => u.id === app.userId)) return;
                
                const appDate = new Date(app.date);
                // Check if valid date
                if (isNaN(appDate.getTime())) return;

                const timeDiff = appDate.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                // If within 1 hour window (0 < diff <= 1 hour)
                if (hoursDiff > 0 && hoursDiff <= 1) {
                     newReminders.push({
                        id: `reminder-${app.id}`,
                        type: 'URGENT',
                        title: 'Sắp diễn ra (1h)',
                        message: `Cuộc hẹn với ${app.customerName} (${subordinates.find(u => u.id === app.userId)?.name})`,
                        time: appDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}),
                        details: app
                    });
                }
            });
            
            setReminders(newReminders);
        };

        check();
        const interval = setInterval(check, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [appointments, subordinates, loading]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [users, depts, apps, consults, revs, monthTargets] = await Promise.all([
                    storageService.getUsers(),
                    storageService.getDepartments(),
                    storageService.getAppointments(),
                    storageService.getConsultations(),
                    storageService.getRevenues(),
                    (storageService as any).getTargetsByMonth(selectedMonth)
                ]);

                setDepartments(depts);
                setTargets(monthTargets);

                // Filter Subordinates
                // Logic similar to AdminDashboard but simpler: Get tree of users under current user
                let teamUsers: User[] = [];
                if (ROLE_RANK[currentUser.role] >= 5) { // Director/Regional
                     teamUsers = users; // Simplified for high level
                } else {
                    // Find direct and indirect subordinates
                    const managedDeptIds = new Set<string>();
                    const collectDepts = (managerId: string) => {
                         const directDepts = depts.filter(d => d.managerId === managerId);
                         directDepts.forEach(d => {
                             managedDeptIds.add(d.id);
                             // Find sub-depts
                             const subDepts = depts.filter(sub => sub.parentId === d.id);
                             subDepts.forEach(sub => managedDeptIds.add(sub.id));
                         });
                    };
                    collectDepts(currentUser.id);
                    
                    teamUsers = users.filter(u => 
                        (u.departmentId && managedDeptIds.has(u.departmentId)) || 
                        u.managerId === currentUser.id
                    );
                }
                // Always include self? Maybe not for "Management" view, but usually yes.
                // Let's include self if they are part of the team stats.
                if (!teamUsers.find(u => u.id === currentUser.id)) {
                    teamUsers.push(currentUser);
                }

                setSubordinates(teamUsers);
                setAppointments(apps);
                setConsultations(consults);
                setRevenues(revs);
                
            } catch (error) {
                console.error("Error loading team data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser, selectedMonth]);

    // --- Derived Data for Selected Month ---
    const { monthStats, teamTotals } = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const todayStr = new Date().toISOString().split('T')[0];
        
        const stats = subordinates.map((user, index) => {
            // Filter data for this user and month
            const userApps = appointments.filter(a => {
                const d = new Date(a.reportedTime || a.date);
                return a.userId === user.id && d.getMonth() + 1 === month && d.getFullYear() === year;
            });
            const userCons = consultations.filter(c => {
                const d = new Date(c.date);
                return c.userId === user.id && d.getMonth() + 1 === month && d.getFullYear() === year;
            });
            const userRevs = revenues.filter(r => {
                const d = new Date(r.date);
                return r.userId === user.id && d.getMonth() + 1 === month && d.getFullYear() === year;
            });

            const todayApps = userApps.filter(a => (a.reportedTime || a.date).startsWith(todayStr));
            const todayCons = userCons.filter(c => c.date.startsWith(todayStr));
            const todayRevs = userRevs.filter(r => r.date.startsWith(todayStr));

            const totalRevenue = userRevs.reduce((sum, r) => sum + r.amountCollected, 0);
            const todayRevenue = todayRevs.reduce((sum, r) => sum + r.amountCollected, 0);
            
            // Find target for this user in this month
            const userTarget = targets.find(t => t.userId === user.id);
            const targetRevenue = userTarget ? userTarget.targetRevenue : 0;

            return {
                stt: index + 1,
                id: user.id,
                name: user.name,
                joinDate: user.joinDate ? new Date(user.joinDate).toLocaleDateString('vi-VN') : '-',
                role: ROLE_LABELS[user.role] || user.role,
                rawRole: user.role,
                target: targetRevenue,
                revenue: totalRevenue,
                todayRevenue: todayRevenue,
                appointments: userApps.length,
                todayAppointments: todayApps.length,
                consultations: userCons.length,
                todayConsultations: todayCons.length
            };
        });

        const totals = stats.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            target: acc.target + curr.target,
            appointments: acc.appointments + curr.appointments,
            consultations: acc.consultations + curr.consultations
        }), { revenue: 0, target: 0, appointments: 0, consultations: 0 });

        return { monthStats: stats, teamTotals: totals };
    }, [subordinates, appointments, consultations, revenues, selectedMonth, targets]);

    // --- Calendar Data ---
    const calendarDays = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            // Find events for this day from ALL subordinates
            const dayApps = appointments.filter(a => (a.reportedTime || a.date).startsWith(dateStr) && subordinates.some(u => u.id === a.userId));
            const dayCons = consultations.filter(c => c.date.startsWith(dateStr) && subordinates.some(u => u.id === c.userId));
            const dayRevs = revenues.filter(r => r.date.startsWith(dateStr) && subordinates.some(u => u.id === r.userId));

            days.push({
                date: dateStr,
                day: i,
                events: [
                    ...dayApps.map(a => ({ type: 'APP', ...a, user: subordinates.find(u => u.id === a.userId)?.name })),
                    ...dayCons.map(c => ({ type: 'CONS', ...c, user: subordinates.find(u => u.id === c.userId)?.name })),
                    ...dayRevs.map(r => ({ type: 'REV', ...r, user: subordinates.find(u => u.id === r.userId)?.name }))
                ]
            });
        }
        return days;
    }, [selectedMonth, appointments, consultations, revenues, subordinates]);

    // --- Helper: Render Event Item for Day Detail ---
    const renderEventItem = useCallback((item: any, type: 'APP' | 'CONS' | 'REV') => {
        const user = subordinates.find(u => u.id === item.userId);
        
        let colorClass = '';
        let icon = null;
        let title = '';
        
        if (type === 'APP') {
            colorClass = 'blue';
            icon = <CalendarIcon size={14} />;
            title = 'CUỘC HẸN';
        } else if (type === 'CONS') {
            colorClass = 'purple';
            icon = <Users size={14} />;
            title = 'TƯ VẤN';
        } else {
            colorClass = 'green';
            icon = <DollarSign size={14} />;
            title = 'DOANH THU';
        }

        const handleMouseEnter = (e: React.MouseEvent) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const tooltipWidth = 280;
            const tooltipHeight = 200; // Approx
            
            let x = rect.right + 10;
            let y = rect.top;

            // Check right edge
            if (x + tooltipWidth > window.innerWidth) {
                x = rect.left - tooltipWidth - 10;
            }
            
            // Check bottom edge (simple check)
            if (y + tooltipHeight > window.innerHeight) {
                y = window.innerHeight - tooltipHeight - 10;
            }

            let content = null;
            if (type === 'APP') {
                content = (
                    <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><UserIcon size={10}/> Khách:</span>
                            <span className="col-span-2 font-bold text-gray-800">{item.customerName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><Phone size={10}/> SĐT:</span>
                            <span className="col-span-2 font-medium text-gray-800">{item.phone}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><MapPin size={10}/> Đ/C:</span>
                            <span className="col-span-2 font-medium text-gray-800">{item.addressDetail || item.location}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><FileText size={10}/> Note:</span>
                            <span className="col-span-2 text-gray-600 italic">{item.notes || 'Không có'}</span>
                        </div>
                    </div>
                );
            } else if (type === 'CONS') {
                content = (
                    <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><UserIcon size={10}/> Khách:</span>
                            <span className="col-span-2 font-bold text-gray-800">{item.customerName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><Phone size={10}/> SĐT:</span>
                            <span className="col-span-2 font-medium text-gray-800">{item.phone}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><FileType size={10}/> Loại:</span>
                            <span className="col-span-2 font-medium text-gray-800">{item.type}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><FileText size={10}/> Note:</span>
                            <span className="col-span-2 text-gray-600 italic">{item.notes || 'Không có'}</span>
                        </div>
                    </div>
                );
            } else {
                content = (
                    <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><UserIcon size={10}/> Khách:</span>
                            <span className="col-span-2 font-bold text-gray-800">{item.customerName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><FileText size={10}/> HĐ:</span>
                            <span className="col-span-2 font-medium text-gray-800">{item.contractCode}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 flex items-center gap-1"><DollarSign size={10}/> Tiền:</span>
                            <span className="col-span-2 font-black text-green-600">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.amountCollected)}
                            </span>
                        </div>
                    </div>
                );
            }

            setTooltipData({
                x,
                y,
                content: (
                    <div className="w-72 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-2xl border border-gray-200 z-[70] animate-fadeIn ring-1 ring-black/5">
                        <h4 className={`font-bold text-${colorClass}-700 border-b border-${colorClass}-100 pb-2 mb-2 text-xs flex items-center gap-2 uppercase`}>
                            {icon} CHI TIẾT {title}
                        </h4>
                        {content}
                    </div>
                )
            });
        };

        return (
            <div 
                key={item.id} 
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setTooltipData(null)}
                className={`group relative bg-${colorClass}-50 p-3 rounded-lg border border-${colorClass}-100 hover:shadow-md transition-all hover:border-${colorClass}-300 hover:bg-${colorClass}-50/80`}
            >
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate" title={item.customerName}>{item.customerName}</p>
                        <p className="text-xs text-gray-600 truncate" title={type === 'APP' ? item.companyName : type === 'CONS' ? item.type : item.contractCode}>
                            {type === 'APP' ? item.companyName : type === 'CONS' ? item.type : item.contractCode}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        {type === 'APP' && <Badge variant="info">{item.status}</Badge>}
                        {type === 'REV' && (
                            <span className="text-xs font-black text-green-600">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.amountCollected)}
                            </span>
                        )}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDateForDayDetail(null);
                                setSelectedUserForDetail(item.userId);
                            }}
                            className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-bold text-${colorClass}-600 bg-white border border-${colorClass}-200 px-2 py-1 rounded-full hover:bg-${colorClass}-50 transition-all duration-200 shadow-sm transform translate-x-2 group-hover:translate-x-0`}
                            title="Xem hồ sơ nhân viên"
                        >
                            <UserIcon size={12} />
                            Hồ sơ
                        </button>
                    </div>
                </div>
                <div className={`mt-2 pt-2 border-t border-${colorClass}-100 flex justify-between items-center text-xs`}>
                    <span className={`text-${colorClass}-700 font-medium flex items-center gap-1`}>
                        <Users size={12}/> {user?.name}
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                        <Clock size={12}/>
                        {type === 'REV' 
                            ? new Date(item.date).toLocaleDateString('vi-VN')
                            : type === 'APP' 
                                ? new Date(item.reportedTime || item.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
                                : new Date(item.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})
                        }
                    </span>
                </div>
            </div>
        );
    }, [subordinates]);

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

    return (
        <div className="space-y-4 animate-fadeIn pb-12 max-w-[1600px] mx-auto px-2 sm:px-4 md:px-6">
            {/* Compact Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button onClick={onBack} variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-500">
                        <ChevronLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
                            QUẢN TRỊ TEAM
                            <span className="text-gray-300 font-light">|</span>
                            <span className="text-blue-600">{currentTeamName}</span>
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Reminders Bell */}
                    <div className="relative">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-500 relative"
                            onClick={() => setShowReminders(!showReminders)}
                        >
                            <Bell size={20} />
                            {reminders.length > 0 && (
                                <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                            )}
                        </Button>
                        
                        {/* Reminders Dropdown */}
                        {showReminders && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn">
                                <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 text-xs uppercase">Nhắc hẹn</h3>
                                    <button onClick={() => setShowReminders(false)}><X size={14} className="text-gray-400 hover:text-gray-600"/></button>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {reminders.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400 text-xs italic">Không có nhắc nhở nào</div>
                                    ) : (
                                        reminders.map((rem, idx) => (
                                            <div key={idx} className="p-3 border-b border-gray-50 hover:bg-blue-50 transition-colors">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-full ${rem.type === 'URGENT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        <Clock size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-800">{rem.title}</p>
                                                        <p className="text-[10px] text-gray-500 mt-0.5">{rem.message}</p>
                                                        <p className="text-[10px] font-bold text-blue-600 mt-1">{rem.time}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 px-2 py-1">
                        <CalendarIcon size={14} className="text-gray-500 mr-2"/>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 outline-none p-0"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowColumnModal(true)} className="px-2 h-8">
                        <Settings size={16} />
                    </Button>
                </div>
            </div>

            {/* Summary Stats - Compact Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <DollarSign size={24} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Doanh Thu</p>
                        <p className="text-sm font-black text-gray-900 truncate">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(teamTotals.revenue)}
                        </p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                        <Target size={24} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Cam Kết</p>
                        <p className="text-sm font-black text-gray-900 truncate">
                            {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(teamTotals.target)}
                        </p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                        <CalendarIcon size={24} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Cuộc Hẹn</p>
                        <p className="text-sm font-black text-gray-900 truncate">{teamTotals.appointments}</p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                        <Users size={24} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Tư Vấn</p>
                        <p className="text-sm font-black text-gray-900 truncate">{teamTotals.consultations}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Statistics Table - Takes 2/3 width on large screens */}
                <div className="lg:col-span-2 flex flex-col">
                    <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm flex-1">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 uppercase">
                                <Users size={16} className="text-blue-600"/> 
                                Nhân sự & Hiệu suất
                            </h3>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {visibleColumns.stt && <th className="px-3 py-2 text-center w-10 bg-gray-100">STT</th>}
                                        {visibleColumns.id && <th className="px-3 py-2 bg-gray-100">Mã NV</th>}
                                        {visibleColumns.name && <th className="px-3 py-2 bg-gray-100">Họ Tên</th>}
                                        {visibleColumns.joinDate && <th className="px-3 py-2 whitespace-nowrap bg-gray-100">Ngày vào</th>}
                                        {visibleColumns.role && <th className="px-3 py-2 whitespace-nowrap bg-gray-100">Chức vụ</th>}
                                        {visibleColumns.target && <th className="px-3 py-2 text-right whitespace-nowrap bg-gray-100">Cam kết</th>}
                                        {visibleColumns.revenue && <th className="px-3 py-2 text-right whitespace-nowrap bg-gray-100">Doanh thu</th>}
                                        {visibleColumns.appointments && <th className="px-3 py-2 text-center whitespace-nowrap bg-gray-100">Hẹn</th>}
                                        {visibleColumns.consultations && <th className="px-3 py-2 text-center whitespace-nowrap bg-gray-100">Tư vấn</th>}
                                        {visibleColumns.todayRevenue && <th className="px-3 py-2 text-right whitespace-nowrap bg-green-50 text-green-700 border-l border-green-100">DT Hôm nay</th>}
                                        {visibleColumns.todayAppointments && <th className="px-3 py-2 text-center whitespace-nowrap bg-blue-50 text-blue-700">Hẹn HN</th>}
                                        {visibleColumns.todayConsultations && <th className="px-3 py-2 text-center whitespace-nowrap bg-purple-50 text-purple-700">TV HN</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {monthStats.map((stat) => (
                                        <tr 
                                            key={stat.id} 
                                            onClick={() => {
                                                if (editingTargetId !== stat.id) {
                                                    setSelectedUserForDetail(stat.id);
                                                }
                                            }}
                                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer text-xs ${selectedUserForDetail === stat.id ? 'bg-blue-50' : ''}`}
                                        >
                                            {visibleColumns.stt && <td className="px-3 py-2.5 text-center font-medium text-gray-500">{stat.stt}</td>}
                                            {visibleColumns.id && <td className="px-3 py-2.5 font-mono text-gray-500">{stat.id}</td>}
                                            {visibleColumns.name && <td className="px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap">{stat.name}</td>}
                                            {visibleColumns.joinDate && <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{stat.joinDate}</td>}
                                            {visibleColumns.role && <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    {stat.role}
                                                </span>
                                            </td>}
                                            {visibleColumns.target && <td className="px-3 py-2.5 text-right font-mono text-gray-600 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {editingTargetId === stat.id ? (
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <input 
                                                            type="text" 
                                                            value={tempTargetValue}
                                                            onChange={(e) => {
                                                                // Format as currency while typing
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setTempTargetValue(new Intl.NumberFormat('vi-VN').format(parseInt(val || '0')));
                                                            }}
                                                            className="w-24 text-right text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveTarget(stat.id);
                                                                if (e.key === 'Escape') setEditingTargetId(null);
                                                            }}
                                                        />
                                                        <button onClick={() => handleSaveTarget(stat.id)} className="text-green-600 hover:text-green-800"><Eye size={14}/></button>
                                                        <button onClick={() => setEditingTargetId(null)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="group flex items-center justify-end gap-2">
                                                        <span>{new Intl.NumberFormat('vi-VN').format(stat.target)}</span>
                                                        <button 
                                                            onClick={() => {
                                                                setEditingTargetId(stat.id);
                                                                setTempTargetValue(new Intl.NumberFormat('vi-VN').format(stat.target));
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-600 transition-opacity"
                                                        >
                                                            <FileText size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>}
                                            {visibleColumns.revenue && <td className="px-3 py-2.5 text-right font-bold text-gray-800 font-mono whitespace-nowrap">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.revenue)}
                                            </td>}
                                            {visibleColumns.appointments && <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.appointments > 0 ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {stat.appointments}
                                                </span>
                                            </td>}
                                            {visibleColumns.consultations && <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.consultations > 0 ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {stat.consultations}
                                                </span>
                                            </td>}
                                            {visibleColumns.todayRevenue && <td className="px-3 py-2.5 text-right font-bold text-green-600 font-mono whitespace-nowrap bg-green-50/30 border-l border-green-50">
                                                {stat.todayRevenue > 0 ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.todayRevenue) : '-'}
                                            </td>}
                                            {visibleColumns.todayAppointments && <td className="px-3 py-2.5 text-center bg-blue-50/30">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.todayAppointments > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-300'}`}>
                                                    {stat.todayAppointments > 0 ? stat.todayAppointments : '-'}
                                                </span>
                                            </td>}
                                            {visibleColumns.todayConsultations && <td className="px-3 py-2.5 text-center bg-purple-50/30">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.todayConsultations > 0 ? 'bg-purple-100 text-purple-700' : 'text-gray-300'}`}>
                                                    {stat.todayConsultations > 0 ? stat.todayConsultations : '-'}
                                                </span>
                                            </td>}
                                        </tr>
                                    ))}
                                    {monthStats.length === 0 && (
                                        <tr>
                                            <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-8 text-center text-gray-400 italic">
                                                Chưa có dữ liệu nhân sự
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Calendar View - Takes 1/3 width on large screens */}
                <div className="lg:col-span-1 flex flex-col">
                    <Card className="p-4 border border-gray-200 shadow-sm flex-1">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 uppercase">
                                <CalendarIcon size={16} className="text-blue-600"/> 
                                Lịch làm việc
                            </h3>
                            <div className="flex gap-2 text-[10px] font-medium">
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Hẹn</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> TV</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> DT</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                <div key={day} className="bg-gray-50 p-1 text-center text-[10px] font-bold text-gray-500 uppercase">
                                    {day}
                                </div>
                            ))}
                            
                            {/* Padding for start of month */}
                            {Array.from({ length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1).getDay() }).map((_, i) => (
                                <div key={`pad-${i}`} className="bg-white min-h-[60px]"></div>
                            ))}

                            {calendarDays.map((day) => {
                                // Filter events if a user is selected
                                const displayEvents = selectedUserForDetail 
                                    ? day.events.filter((e: any) => e.userId === selectedUserForDetail)
                                    : day.events;
                                
                                const today = new Date();
                                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                const isToday = todayStr === day.date;

                                return (
                                    <div 
                                        key={day.date} 
                                        onClick={() => setSelectedDateForDayDetail(day.date)}
                                        className={`bg-white min-h-[60px] p-1 hover:bg-gray-50 transition-colors group relative cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="text-right mb-1">
                                            <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                                                {day.day}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1 mt-1 px-0.5">
                                            {displayEvents.filter((e: any) => e.type === 'APP').length > 0 && (
                                                <div className="bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded text-center leading-none shadow-sm" title={`${displayEvents.filter((e: any) => e.type === 'APP').length} Cuộc hẹn`}>
                                                    {displayEvents.filter((e: any) => e.type === 'APP').length} Hẹn
                                                </div>
                                            )}
                                            {displayEvents.filter((e: any) => e.type === 'CONS').length > 0 && (
                                                <div className="bg-purple-500 text-white text-[9px] font-bold px-1 py-0.5 rounded text-center leading-none shadow-sm" title={`${displayEvents.filter((e: any) => e.type === 'CONS').length} Tư vấn`}>
                                                    {displayEvents.filter((e: any) => e.type === 'CONS').length} TV
                                                </div>
                                            )}
                                            {displayEvents.filter((e: any) => e.type === 'REV').length > 0 && (
                                                <div className="bg-green-500 text-white text-[9px] font-bold px-1 py-0.5 rounded text-center leading-none shadow-sm" title={`${displayEvents.filter((e: any) => e.type === 'REV').length} Doanh thu`}>
                                                    {displayEvents.filter((e: any) => e.type === 'REV').length} DT
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 text-xs text-gray-500 text-center italic">
                            * Chọn ngày hoặc nhân viên để xem chi tiết
                        </div>
                    </Card>
                </div>
            </div>

            {/* Column Customization Modal */}
            <Modal isOpen={showColumnModal} onClose={() => setShowColumnModal(false)} title="TÙY CHỈNH CỘT HIỂN THỊ">
                <div className="p-1 grid grid-cols-2 gap-4">
                    {Object.entries(visibleColumns).map(([key, value]) => (
                        <label key={key} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={value} 
                                onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }))}
                                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 uppercase">
                                {key === 'stt' && 'Số thứ tự'}
                                {key === 'id' && 'Mã nhân viên'}
                                {key === 'name' && 'Họ tên'}
                                {key === 'joinDate' && 'Ngày vào'}
                                {key === 'role' && 'Chức vụ'}
                                {key === 'target' && 'Cam kết'}
                                {key === 'revenue' && 'Doanh thu'}
                                {key === 'todayRevenue' && 'Doanh thu hôm nay'}
                                {key === 'appointments' && 'Cuộc hẹn'}
                                {key === 'todayAppointments' && 'Cuộc hẹn hôm nay'}
                                {key === 'consultations' && 'Tư vấn'}
                                {key === 'todayConsultations' && 'Tư vấn hôm nay'}
                            </span>
                        </label>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button onClick={() => setShowColumnModal(false)}>Đóng</Button>
                </div>
            </Modal>

            {/* User Detail Modal */}
            {selectedUserForDetail && (
                <Modal isOpen={!!selectedUserForDetail} onClose={() => setSelectedUserForDetail(null)} title="CHI TIẾT HOẠT ĐỘNG" size="lg">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900">{subordinates.find(u => u.id === selectedUserForDetail)?.name}</h4>
                                <p className="text-sm text-gray-500">Mã NV: {selectedUserForDetail}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedUserForDetail(null)}>
                                <X size={20} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Appointments List */}
                            <div>
                                <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> CUỘC HẸN ({selectedMonth})
                                </h5>
                                <div className="bg-gray-50 rounded-lg p-3 max-h-[300px] overflow-y-auto space-y-2">
                                    {appointments.filter(a => a.userId === selectedUserForDetail && (a.reportedTime || a.date).startsWith(selectedMonth)).length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-4">Không có cuộc hẹn nào</p>
                                    ) : (
                                        appointments.filter(a => a.userId === selectedUserForDetail && (a.reportedTime || a.date).startsWith(selectedMonth))
                                        .sort((a,b) => new Date(a.reportedTime || a.date).getTime() - new Date(b.reportedTime || b.date).getTime())
                                        .map(app => (
                                            <div key={app.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm text-xs">
                                                <div className="font-bold text-gray-800">{new Date(app.reportedTime || app.date).toLocaleDateString('vi-VN')} {new Date(app.reportedTime || app.date).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
                                                <div className="text-blue-600 font-medium">{app.customerName}</div>
                                                <div className="text-gray-500">{app.companyName}</div>
                                                <div className="text-gray-500 mt-1">Hẹn lúc: {new Date(app.date).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
                                                <div className="mt-1 flex justify-between items-center">
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{app.status}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Consultations List */}
                            <div>
                                <h5 className="font-bold text-purple-700 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-600"></span> TƯ VẤN ({selectedMonth})
                                </h5>
                                <div className="bg-gray-50 rounded-lg p-3 max-h-[300px] overflow-y-auto space-y-2">
                                    {consultations.filter(c => c.userId === selectedUserForDetail && c.date.startsWith(selectedMonth)).length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-4">Không có phiếu tư vấn nào</p>
                                    ) : (
                                        consultations.filter(c => c.userId === selectedUserForDetail && c.date.startsWith(selectedMonth))
                                        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map(cons => (
                                            <div key={cons.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm text-xs">
                                                <div className="font-bold text-gray-800">{new Date(cons.date).toLocaleDateString('vi-VN')}</div>
                                                <div className="text-purple-600 font-medium">{cons.customerName}</div>
                                                <div className="text-gray-500">{cons.type}</div>
                                                <div className="mt-1 text-[10px] text-gray-400 truncate">{cons.notes}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Day Detail Modal */}
            {selectedDateForDayDetail && (
                <Modal isOpen={!!selectedDateForDayDetail} onClose={() => setSelectedDateForDayDetail(null)} title={`LỊCH NGÀY ${new Date(selectedDateForDayDetail).toLocaleDateString('vi-VN')}`} size="md">
                    <div className="space-y-4 pb-4">
                        {(() => {
                            const dayApps = appointments.filter(a => (a.reportedTime || a.date).startsWith(selectedDateForDayDetail) && subordinates.some(u => u.id === a.userId));
                            const dayCons = consultations.filter(c => c.date.startsWith(selectedDateForDayDetail) && subordinates.some(u => u.id === c.userId));
                            const dayRevs = revenues.filter(r => r.date.startsWith(selectedDateForDayDetail) && subordinates.some(u => u.id === r.userId));
                            
                            if (dayApps.length === 0 && dayCons.length === 0 && dayRevs.length === 0) {
                                return <p className="text-center text-gray-400 italic py-8">Không có hoạt động nào trong ngày này</p>;
                            }

                            return (
                                <>
                                    {dayApps.length > 0 && (
                                        <div>
                                            <h5 className="font-bold text-blue-700 mb-2 flex items-center gap-2 text-sm uppercase">
                                                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Cuộc hẹn ({dayApps.length})
                                            </h5>
                                            <div className="space-y-2">
                                                {dayApps.map(app => renderEventItem(app, 'APP'))}
                                            </div>
                                        </div>
                                    )}

                                    {dayCons.length > 0 && (
                                        <div>
                                            <h5 className="font-bold text-purple-700 mb-2 flex items-center gap-2 text-sm uppercase">
                                                <span className="w-2 h-2 rounded-full bg-purple-600"></span> Tư vấn ({dayCons.length})
                                            </h5>
                                            <div className="space-y-2">
                                                {dayCons.map(cons => renderEventItem(cons, 'CONS'))}
                                            </div>
                                        </div>
                                    )}

                                    {dayRevs.length > 0 && (
                                        <div>
                                            <h5 className="font-bold text-green-700 mb-2 flex items-center gap-2 text-sm uppercase">
                                                <span className="w-2 h-2 rounded-full bg-green-600"></span> Doanh thu ({dayRevs.length})
                                            </h5>
                                            <div className="space-y-2">
                                                {dayRevs.map(rev => renderEventItem(rev, 'REV'))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </Modal>
            )}

            {/* Global Tooltip Portal */}
            {tooltipData && (
                <div 
                    className="fixed z-[70] pointer-events-none"
                    style={{ left: tooltipData.x, top: tooltipData.y }}
                >
                    {tooltipData.content}
                </div>
            )}
        </div>
    );
};
