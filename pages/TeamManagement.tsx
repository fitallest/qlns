import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, Consultation, Revenue, MonthlyTarget, ROLE_RANK, Department, ROLE_LABELS } from '../types';
import { storageService } from '../services/storageService';
import { Loader2, Calendar as CalendarIcon, Users, DollarSign, Target, ChevronLeft, ChevronRight, Settings, Filter, Eye, X, Bell, Clock } from 'lucide-react';
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
        joinDate: true,
        role: true,
        target: true,
        revenue: true,
        appointments: true,
        consultations: true
    });
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<string | null>(null);
    const [selectedDateForDayDetail, setSelectedDateForDayDetail] = useState<string | null>(null);
    
    // Reminders State
    const [reminders, setReminders] = useState<any[]>([]);
    const [showReminders, setShowReminders] = useState(false);

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

    // Check Reminders
    useEffect(() => {
        if (loading || appointments.length === 0) return;

        const check = () => {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const currentHour = now.getHours();
            
            let newReminders: any[] = [];

            if (currentHour >= 8) {
                const todayApps = appointments.filter(a => a.date.startsWith(todayStr) && subordinates.some(u => u.id === a.userId));
                if (todayApps.length > 0) {
                    newReminders.push({
                        id: 'daily-summary',
                        type: 'DAILY',
                        title: 'Lịch hẹn hôm nay',
                        message: `Team có ${todayApps.length} cuộc hẹn trong hôm nay.`,
                        time: '08:00',
                        count: todayApps.length
                    });
                }
            }

            appointments.forEach(app => {
                if (!subordinates.some(u => u.id === app.userId)) return;
                
                const appDate = new Date(app.date);
                if (isNaN(appDate.getTime())) return;

                const timeDiff = appDate.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                if (hoursDiff > 0 && hoursDiff <= 2) {
                     newReminders.push({
                        id: `reminder-${app.id}`,
                        type: 'URGENT',
                        title: 'Sắp diễn ra',
                        message: `Cuộc hẹn với ${app.customerName} (${subordinates.find(u => u.id === app.userId)?.name})`,
                        time: appDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}),
                        details: app
                    });
                }
            });
            
            setReminders(newReminders);
        };

        check();
        const interval = setInterval(check, 60000); 
        return () => clearInterval(interval);
    }, [appointments, subordinates, loading]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // FIX: Lấy toàn bộ target hoặc gọi API chuẩn, thay vì ép kiểu "as any"
                // Cách tiếp cận này giúp TypeScript an tâm và app không bị crash nếu API thiếu hàm
                const [users, depts, apps, consults, revs, allTargets] = await Promise.all([
                    storageService.getUsers(),
                    storageService.getDepartments(),
                    storageService.getAppointments(),
                    storageService.getConsultations(),
                    storageService.getRevenues(),
                    // Kiểm tra xem hàm có tồn tại thật không, nếu không thì fallback về mảng rỗng
                    'getTargetsByMonth' in storageService 
                        ? (storageService as unknown as { getTargetsByMonth: (m: string) => Promise<MonthlyTarget[]> }).getTargetsByMonth(selectedMonth)
                        : Promise.resolve([] as MonthlyTarget[])
                ]);

                setDepartments(depts);
                setTargets(allTargets);

                let teamUsers: User[] = [];
                if (ROLE_RANK[currentUser.role] >= 5) {
                     teamUsers = users;
                } else {
                    const managedDeptIds = new Set<string>();
                    const collectDepts = (managerId: string) => {
                         const directDepts = depts.filter(d => d.managerId === managerId);
                         directDepts.forEach(d => {
                             managedDeptIds.add(d.id);
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
        
        const stats = subordinates.map((user, index) => {
            const userApps = appointments.filter(a => {
                const d = new Date(a.date);
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

            const totalRevenue = userRevs.reduce((sum, r) => sum + r.amountCollected, 0);
            
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
                appointments: userApps.length,
                consultations: userCons.length
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

    const calendarDays = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            const dayApps = appointments.filter(a => a.date.startsWith(dateStr) && subordinates.some(u => u.id === a.userId));
            const dayCons = consultations.filter(c => c.date.startsWith(dateStr) && subordinates.some(u => u.id === c.userId));

            days.push({
                date: dateStr,
                day: i,
                events: [
                    ...dayApps.map(a => ({ type: 'APP', ...a, user: subordinates.find(u => u.id === a.userId)?.name })),
                    ...dayCons.map(c => ({ type: 'CONS', ...c, user: subordinates.find(u => u.id === c.userId)?.name }))
                ]
            });
        }
        return days;
    }, [selectedMonth, appointments, consultations, subordinates]);

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

    return (
        <div className="space-y-4 animate-fadeIn pb-12">
            {/* Header section ... */}
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

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <DollarSign size={18} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Doanh Thu</p>
                        <p className="text-sm font-black text-gray-900 truncate">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(teamTotals.revenue)}
                        </p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                        <Target size={18} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Cam Kết</p>
                        <p className="text-sm font-black text-gray-900 truncate">
                            {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(teamTotals.target)}
                        </p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                        <CalendarIcon size={18} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Cuộc Hẹn</p>
                        <p className="text-sm font-black text-gray-900 truncate">{teamTotals.appointments}</p>
                    </div>
                </div>

                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                        <Users size={18} />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">Tư Vấn</p>
                        <p className="text-sm font-black text-gray-900 truncate">{teamTotals.consultations}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 flex flex-col">
                    <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm flex-1">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 uppercase">
                                <Users size={16} className="text-blue-600"/> 
                                Nhân sự & Hiệu suất
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] sticky top-0 z-10">
                                    <tr>
                                        {visibleColumns.stt && <th className="px-3 py-2 text-center w-10">STT</th>}
                                        {visibleColumns.id && <th className="px-3 py-2">Mã NV</th>}
                                        {visibleColumns.name && <th className="px-3 py-2">Họ Tên</th>}
                                        {visibleColumns.joinDate && <th className="px-3 py-2 whitespace-nowrap">Ngày vào</th>}
                                        {visibleColumns.role && <th className="px-3 py-2 whitespace-nowrap">Chức vụ</th>}
                                        {visibleColumns.target && <th className="px-3 py-2 text-right whitespace-nowrap">Cam kết</th>}
                                        {visibleColumns.revenue && <th className="px-3 py-2 text-right whitespace-nowrap">Doanh thu</th>}
                                        {visibleColumns.appointments && <th className="px-3 py-2 text-center whitespace-nowrap">Hẹn</th>}
                                        {visibleColumns.consultations && <th className="px-3 py-2 text-center whitespace-nowrap">Tư vấn</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {monthStats.map((stat) => (
                                        <tr 
                                            key={stat.id} 
                                            onClick={() => setSelectedUserForDetail(stat.id)}
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
                                            {visibleColumns.target && <td className="px-3 py-2.5 text-right font-mono text-gray-600 whitespace-nowrap">
                                                {new Intl.NumberFormat('vi-VN').format(stat.target)}
                                            </td>}
                                            {visibleColumns.revenue && <td className="px-3 py-2.5 text-right font-bold text-green-600 font-mono whitespace-nowrap">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stat.revenue)}
                                            </td>}
                                            {visibleColumns.appointments && <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.appointments > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {stat.appointments}
                                                </span>
                                            </td>}
                                            {visibleColumns.consultations && <td className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[10px] ${stat.consultations > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {stat.consultations}
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
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                <div key={day} className="bg-gray-50 p-1 text-center text-[10px] font-bold text-gray-500 uppercase">
                                    {day}
                                </div>
                            ))}
                            
                            {Array.from({ length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1).getDay() }).map((_, i) => (
                                <div key={`pad-${i}`} className="bg-white min-h-[60px]"></div>
                            ))}

                            {calendarDays.map((day) => {
                                const displayEvents = selectedUserForDetail 
                                    ? day.events.filter((e: any) => e.userId === selectedUserForDetail)
                                    : day.events;
                                
                                const isToday = new Date().toISOString().startsWith(day.date);

                                return (
                                    <div 
                                        key={day.date} 
                                        onClick={() => setSelectedDateForDayDetail(day.date)}
                                        className={`bg-white min-h-[60px] p-1 hover:bg-gray-50 transition-colors group relative cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className="text-right mb-1">
                                            <span className={`text-[10px] font-bold ${isToday ? 'bg-blue-600 text-white px-1 py-0.5 rounded-full' : 'text-gray-400'}`}>
                                                {day.day}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {displayEvents.slice(0, 2).map((evt: any, idx: number) => (
                                                <div key={`${evt.id}-${idx}`} className={`w-full h-1.5 rounded-full ${
                                                    evt.type === 'APP' ? 'bg-blue-400' : 'bg-purple-400'
                                                }`} title={`${evt.type === 'APP' ? 'Hẹn' : 'Tư vấn'}: ${evt.customerName} (${evt.user})`}></div>
                                            ))}
                                            {displayEvents.length > 2 && (
                                                <div className="text-[8px] text-gray-400 text-center leading-none">
                                                    +{displayEvents.length - 2}
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

            {/* Modals */}
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
                                {key === 'appointments' && 'Cuộc hẹn'}
                                {key === 'consultations' && 'Tư vấn'}
                            </span>
                        </label>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button onClick={() => setShowColumnModal(false)}>Đóng</Button>
                </div>
            </Modal>

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
                            <div>
                                <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> CUỘC HẸN ({selectedMonth})
                                </h5>
                                <div className="bg-gray-50 rounded-lg p-3 max-h-[300px] overflow-y-auto space-y-2">
                                    {appointments.filter(a => a.userId === selectedUserForDetail && a.date.startsWith(selectedMonth)).length === 0 ? (
                                        <p className="text-xs text-gray-400 italic text-center py-4">Không có cuộc hẹn nào</p>
                                    ) : (
                                        appointments.filter(a => a.userId === selectedUserForDetail && a.date.startsWith(selectedMonth))
                                        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map(app => (
                                            <div key={app.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm text-xs">
                                                <div className="font-bold text-gray-800">{new Date(app.date).toLocaleDateString('vi-VN')}</div>
                                                <div className="text-blue-600 font-medium">{app.customerName}</div>
                                                <div className="text-gray-500">{app.companyName}</div>
                                                <div className="mt-1 flex justify-between items-center">
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{app.status}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

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

            {selectedDateForDayDetail && (
                <Modal isOpen={!!selectedDateForDayDetail} onClose={() => setSelectedDateForDayDetail(null)} title={`LỊCH NGÀY ${new Date(selectedDateForDayDetail).toLocaleDateString('vi-VN')}`} size="md">
                    <div className="space-y-4">
                        {(() => {
                            const dayApps = appointments.filter(a => a.date.startsWith(selectedDateForDayDetail) && subordinates.some(u => u.id === a.userId));
                            const dayCons = consultations.filter(c => c.date.startsWith(selectedDateForDayDetail) && subordinates.some(u => u.id === c.userId));
                            
                            if (dayApps.length === 0 && dayCons.length === 0) {
                                return <p className="text-center text-gray-400 italic py-8">Không có hoạt động nào trong ngày này</p>;
                            }

                            return (
                                <>
                                    {dayApps.length > 0 && (
                                        <div>
                                            <h5 className="font-bold text-blue-700 mb-2 flex items-center gap-2 text-sm">
                                                <span className="w-2 h-2 rounded-full bg-blue-600"></span> CUỘC HẸN ({dayApps.length})
                                            </h5>
                                            <div className="space-y-2">
                                                {dayApps.map(app => (
                                                    <div key={app.id} className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-bold text-gray-900 text-sm">{app.customerName}</p>
                                                                <p className="text-xs text-gray-600">{app.companyName}</p>
                                                            </div>
                                                            <Badge variant="info">{app.status}</Badge>
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-blue-100 flex justify-between items-center text-xs">
                                                            <span className="text-blue-700 font-medium">
                                                                NV: {subordinates.find(u => u.id === app.userId)?.name}
                                                            </span>
                                                            <span className="text-gray-500">
                                                                {new Date(app.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {dayCons.length > 0 && (
                                        <div>
                                            <h5 className="font-bold text-purple-700 mb-2 flex items-center gap-2 text-sm">
                                                <span className="w-2 h-2 rounded-full bg-purple-600"></span> TƯ VẤN ({dayCons.length})
                                            </h5>
                                            <div className="space-y-2">
                                                {dayCons.map(cons => (
                                                    <div key={cons.id} className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-bold text-gray-900 text-sm">{cons.customerName}</p>
                                                                <p className="text-xs text-gray-600">{cons.type}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-purple-100 flex justify-between items-center text-xs">
                                                            <span className="text-purple-700 font-medium">
                                                                NV: {subordinates.find(u => u.id === cons.userId)?.name}
                                                            </span>
                                                            <span className="text-gray-500">
                                                                {new Date(cons.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </Modal>
            )}
        </div>
    );
};
