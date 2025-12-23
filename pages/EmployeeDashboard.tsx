
import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, Consultation, Revenue, ProjectProfile, AppointmentStatus, RevenueType, ConsultationType, SupportType } from '../types';
import { storageService } from '../services/storageService';
import { Button, Input, Select, Card, Badge, Modal, Combobox } from '../components/ui';
import { Calendar, MessageSquare, TrendingUp, Plus, Edit, Trash2, Phone, DollarSign, MapPin, Building2, ExternalLink, Clock, Layers, Globe, ChevronRight, Search, FileText, ChevronDown, ChevronUp, History, Layout, MessageCircle, Download } from 'lucide-react';
import { VIETNAM_PROVINCES } from '../constants';

interface EmployeeDashboardProps {
  user: User;
  isViewOnly?: boolean;
}

// Helper type for merged list
type DashboardItem = 
  | (Appointment & { dataType: 'APP' })
  | (Consultation & { dataType: 'CONS' })
  | (Revenue & { dataType: 'REV' });

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ user, isViewOnly = false }) => {
  // State for data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [projects, setProjects] = useState<ProjectProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // View State
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'PROJECTS'>('TIMELINE');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // State for Project Expansion
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10),
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0, 10)
  });

  // Modals state
  const [isAppModalOpen, setAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<Appointment>>({});

  const [isConsModalOpen, setConsModalOpen] = useState(false);
  const [editingCons, setEditingCons] = useState<Partial<Consultation>>({});

  const [isRevModalOpen, setRevModalOpen] = useState(false);
  const [editingRev, setEditingRev] = useState<Partial<Revenue>>({});

  const [isProjModalOpen, setProjModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Partial<ProjectProfile>>({});

  // Fetch Data
  const loadData = async () => {
    setLoading(true);
    try {
        const [allApps, allCons, allRevs, allProjs] = await Promise.all([
            storageService.getAppointments(),
            storageService.getConsultations(),
            storageService.getRevenues(),
            storageService.getProjects(),
        ]);

        setAppointments(allApps.filter(a => a.userId === user.id));
        setConsultations(allCons.filter(c => c.userId === user.id));
        setRevenues(allRevs.filter(r => r.userId === user.id));
        setProjects(allProjs.filter(p => p.userId === user.id));

    } catch (error) {
        console.error("Error loading employee data", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const toggleProject = (contractCode: string) => {
      setExpandedProjects(prev => ({ ...prev, [contractCode]: !prev[contractCode] }));
  };

  // --- AUTO FILL CUSTOMER INFO ---
  const autofillCustomerInfo = async (phone: string, type: 'APP' | 'CONS' | 'PROJ') => {
      if (!phone || phone.length < 8) return;
      
      try {
          const info = await storageService.findCustomerByPhone(phone);
          if (info) {
              if (type === 'APP') {
                  setEditingApp(prev => ({
                      ...prev,
                      customerName: prev.customerName || info.name,
                      companyName: prev.companyName || info.company,
                      addressDetail: prev.addressDetail || info.address,
                      location: prev.location || info.city
                  }));
              } else if (type === 'CONS') {
                  setEditingCons(prev => ({
                      ...prev,
                      customerName: prev.customerName || info.name,
                      // Consultation often requires less detailed auto-fill, but we can add company if needed
                  }));
              } else if (type === 'PROJ') {
                  setEditingProj(prev => ({
                      ...prev,
                      customerName: prev.customerName || info.name,
                      companyName: prev.companyName || info.company,
                      address: prev.address || info.address,
                      region: prev.region || info.city
                  }));
              }
          }
      } catch (e) {
          console.error("Autofill failed", e);
      }
  };

  // --- Handlers ---
  const handleSaveApp = async () => {
      if (!editingApp.customerName || !editingApp.phone || !editingApp.date) return alert("Thiếu thông tin bắt buộc");
      try {
          const appData = { ...editingApp, userId: user.id, status: editingApp.status || AppointmentStatus.NEW } as Appointment;
          if (!appData.id) appData.id = `APP_${Date.now()}`;
          if (editingApp.id) await storageService.updateAppointment(appData, {id: user.id, name: user.name});
          else await storageService.addAppointment(appData, {id: user.id, name: user.name});
          setAppModalOpen(false); loadData();
      } catch (e: any) { alert(e.message); }
  };
  const handleDeleteApp = async (id: string) => { if (!confirm("Xóa cuộc hẹn này?")) return; await storageService.deleteAppointment(id, {id: user.id, name: user.name}); loadData(); };

  const handleSaveCons = async () => {
      if (!editingCons.customerName || !editingCons.phone || !editingCons.date) return alert("Thiếu thông tin bắt buộc");
      try {
          const consData = { ...editingCons, userId: user.id, type: editingCons.type || ConsultationType.NEW, supportType: editingCons.supportType || SupportType.SOLO } as Consultation;
          if (!consData.id) consData.id = `CONS_${Date.now()}`;
          if (editingCons.id) await storageService.updateConsultation(consData, {id: user.id, name: user.name});
          else await storageService.addConsultation(consData, {id: user.id, name: user.name});
          setConsModalOpen(false); loadData();
      } catch (e: any) { alert(e.message); }
  };
  const handleDeleteCons = async (id: string) => { if (!confirm("Xóa phiếu tư vấn này?")) return; await storageService.deleteConsultation(id, {id: user.id, name: user.name}); loadData(); };

  const handleSaveRev = async () => {
      if (!editingRev.contractCode || !editingRev.amountCollected || !editingRev.date) return alert("Thiếu thông tin bắt buộc");
      try {
          const revData = { ...editingRev, userId: user.id, type: editingRev.type || RevenueType.NEW, isApproved: editingRev.isApproved || false, contractValue: editingRev.contractValue || editingRev.amountCollected } as Revenue;
          if (!revData.id) revData.id = `REV_${Date.now()}`;
          if (editingRev.id) await storageService.updateRevenue(revData, {id: user.id, name: user.name});
          else await storageService.addRevenue(revData, {id: user.id, name: user.name});
          
          if (revData.type === RevenueType.NEW) {
              const existingProj = projects.find(p => p.contractCode === revData.contractCode);
              if (!existingProj) {
                  await storageService.addProject({ contractCode: revData.contractCode, userId: user.id, customerName: revData.customerName || '', phone: revData.phone || '', contractValue: revData.contractValue });
              }
          }
          setRevModalOpen(false); loadData();
      } catch (e: any) { alert(e.message); }
  };
  const handleDeleteRev = async (id: string) => { if (!confirm("Xóa khoản thu này?")) return; await storageService.deleteRevenue(id, {id: user.id, name: user.name}); loadData(); };

  const handleSaveProject = async () => {
      if (!editingProj.contractCode) return alert("Thiếu mã hợp đồng");
      try {
          const projData = { ...editingProj, userId: user.id } as ProjectProfile;
          const exists = projects.some(p => p.contractCode === editingProj.contractCode);
          if (exists) await storageService.updateProject(projData, {id: user.id, name: user.name}); else await storageService.addProject(projData);
          setProjModalOpen(false); loadData();
      } catch (e: any) { alert(e.message); }
  };
  const handleDeleteProject = async (contractCode: string) => { if (!confirm(`Bạn chắc chắn muốn xóa dự án ${contractCode}?`)) return; await storageService.deleteProject(contractCode, {id: user.id, name: user.name}); setProjModalOpen(false); loadData(); };

  // --- Statistics Calculation ---
  const currentMonthStart = new Date().toISOString().substring(0, 7);
  const totalRevenueLifetime = revenues.reduce((sum, r) => sum + r.amountCollected, 0) + (user.initialRevenue || 0);
  
  // Filter data by range for KPI
  const kpiRevenues = revenues.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
  const kpiAppointments = appointments.filter(a => a.date >= dateRange.start && a.date <= dateRange.end);
  const kpiConsultations = consultations.filter(c => c.date >= dateRange.start && c.date <= dateRange.end);

  const stats = {
      revenue: kpiRevenues.reduce((sum, r) => sum + r.amountCollected, 0),
      apps: kpiAppointments.length,
      cons: kpiConsultations.length
  };

  // Mock Targets (In real app, fetch from DB)
  const targets = {
      revenue: 40000000,
      apps: 16,
      cons: 12
  };

  // --- Merge & Group Data ---
  const mergedData = useMemo(() => {
      const items: DashboardItem[] = [
          ...appointments.map(a => ({ ...a, dataType: 'APP' as const })),
          ...consultations.map(c => ({ ...c, dataType: 'CONS' as const })),
          ...revenues.map(r => ({ ...r, dataType: 'REV' as const })),
      ];

      // Filter
      const filtered = items.filter(item => {
          const date = item.date.substring(0, 10);
          const inRange = date >= dateRange.start && date <= dateRange.end;
          const matchesSearch = searchTerm === '' || 
              item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
              (item.phone && item.phone.includes(searchTerm)) ||
              (item.dataType === 'REV' && item.contractCode.toLowerCase().includes(searchTerm.toLowerCase()));
          return inRange && matchesSearch;
      });

      // Sort Descending by Time
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Group by Date
      const groups: Record<string, DashboardItem[]> = {};
      filtered.forEach(item => {
          const dateKey = item.date.substring(0, 10);
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(item);
      });

      return groups;
  }, [appointments, consultations, revenues, searchTerm, dateRange]);


  // --- EXCEL EXPORT ---
  const handleExportExcel = () => {
      if (!(window as any).XLSX) return alert("Thư viện Excel chưa tải xong. Vui lòng thử lại sau giây lát.");
      
      const data = projects.map(p => {
          const relatedRevs = revenues.filter(r => r.contractCode === p.contractCode);
          const totalPaid = relatedRevs.reduce((sum, r) => sum + r.amountCollected, 0);
          return {
              "Mã HĐ": p.contractCode,
              "Khách hàng": p.customerName,
              "Số điện thoại": p.phone,
              "Công ty/Brand": p.companyName,
              "Lĩnh vực": p.industry,
              "Khu vực": p.region,
              "Web Link": p.webLink,
              "Trạng thái": p.status || 'Đang triển khai',
              "Tổng giá trị": p.contractValue,
              "Đã thu": totalPaid,
              "Còn lại": (p.contractValue || 0) - totalPaid,
              "Ngày ký": p.signDate || '',
              "Người ký chung": p.jointSigner || ''
          };
      });

      const ws = (window as any).XLSX.utils.json_to_sheet(data);
      const wb = (window as any).XLSX.utils.book_new();
      (window as any).XLSX.utils.book_append_sheet(wb, ws, "Danh sách dự án");
      (window as any).XLSX.writeFile(wb, `Du_lieu_du_an_${user.id}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Helper to render items
  const renderItem = (item: DashboardItem) => {
      const timeStr = new Date(item.date).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});
      
      if (item.dataType === 'REV') {
          return (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-l-xl"></div>
                  <div className="flex justify-between items-start pl-2">
                      <div className="space-y-1">
                          <div className="flex items-center gap-2">
                              <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-0.5 rounded border border-orange-100">{timeStr}</span>
                              <Badge variant="warning">{item.type}</Badge>
                          </div>
                          <div className="font-bold text-gray-800 text-lg">{item.customerName}</div>
                          <div className="text-xs font-bold text-gray-500 uppercase">HỢP ĐỒNG: <span className="text-blue-600">{item.contractCode}</span></div>
                      </div>
                      <div className="text-right">
                           <div className="flex justify-end gap-2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isViewOnly && <button onClick={() => {setEditingRev(item); setRevModalOpen(true)}} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>}
                                {!isViewOnly && <button onClick={() => handleDeleteRev(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>}
                           </div>
                           <div className="text-[10px] text-gray-400 font-bold uppercase">SỐ TIỀN ĐÃ THU</div>
                           <div className="text-xl font-black text-orange-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.amountCollected)}</div>
                      </div>
                  </div>
              </div>
          );
      }

      if (item.dataType === 'APP') {
          return (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-l-xl"></div>
                  <div className="flex justify-between items-start pl-2">
                      <div className="space-y-1">
                          <div className="flex items-center gap-2">
                              <span className="text-purple-600 font-bold text-xs bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{timeStr}</span>
                              <Badge variant="info">{item.status}</Badge>
                          </div>
                          <div className="font-bold text-gray-800 text-lg">{item.customerName}</div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                              <span className="flex items-center gap-1"><Phone size={12}/> {item.phone}</span>
                              {item.companyName && <span className="flex items-center gap-1"><Building2 size={12}/> {item.companyName}</span>}
                              {item.location && <span className="flex items-center gap-1"><MapPin size={12}/> {item.location}</span>}
                          </div>
                      </div>
                      <div className="text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isViewOnly && <button onClick={() => {setEditingApp(item); setAppModalOpen(true)}} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>}
                                {!isViewOnly && <button onClick={() => handleDeleteApp(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>}
                           </div>
                      </div>
                  </div>
              </div>
          );
      }

      if (item.dataType === 'CONS') {
          return (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500 rounded-l-xl"></div>
                  <div className="flex justify-between items-start pl-2">
                      <div className="space-y-1">
                          <div className="flex items-center gap-2">
                              <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-0.5 rounded border border-green-100">{timeStr}</span>
                              <Badge variant="indigo">{item.supportType}</Badge>
                              <Badge variant="success">{item.type}</Badge>
                          </div>
                          <div className="font-bold text-gray-800 text-lg">{item.customerName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1"><Phone size={12}/> {item.phone}</span>
                              {item.supportPersonName && <span className="text-gray-400 pl-2 border-l">Hỗ trợ: {item.supportPersonName}</span>}
                          </div>
                      </div>
                      <div className="text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isViewOnly && <button onClick={() => {setEditingCons(item); setConsModalOpen(true)}} className="text-gray-400 hover:text-blue-600"><Edit size={16}/></button>}
                                {!isViewOnly && <button onClick={() => handleDeleteCons(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>}
                           </div>
                      </div>
                  </div>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="space-y-6">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <div className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">DOANH THU (THỰC TẾ)</div>
                    <div className="text-4xl font-black">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenueLifetime)}</div>
                    <div className="text-[10px] mt-2 opacity-70 font-medium">Cộng dồn ban đầu: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user.initialRevenue || 0)}</div>
                    <div className="text-[10px] opacity-70 font-medium">Tính trong khoảng thời gian đang lọc bên dưới</div>
                </div>
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                   <Layers size={32} className="text-white/80" />
                </div>
            </div>
            
            {/* Main Nav in Banner */}
            <div className="mt-8 flex flex-wrap gap-3">
                 <button onClick={() => setViewMode('TIMELINE')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase transition-all ${viewMode === 'TIMELINE' ? 'bg-blue-500 text-white shadow-lg ring-2 ring-white/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    <History size={16}/> Nhật ký hoạt động
                 </button>
                 <button onClick={() => setViewMode('PROJECTS')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase transition-all ${viewMode === 'PROJECTS' ? 'bg-white text-blue-700 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    <FileText size={16}/> Dữ liệu dự án
                 </button>
                 <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase bg-blue-600 text-white hover:bg-blue-500 transition-all ml-auto border border-blue-400/30">
                    <MessageCircle size={16}/> Trao đổi <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">3</span>
                 </button>
            </div>
        </div>

        {/* View Mode: TIMELINE */}
        {viewMode === 'TIMELINE' && (
            <div className="space-y-6 animate-fadeIn">
                 {/* KPI Cards */}
                 <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-blue-100 p-1.5 rounded text-blue-600"><Layout size={16}/></div>
                        <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">CHỈ SỐ CÁ NHÂN (SELF-SALES)</h3>
                        <span className="text-[10px] text-gray-400 ml-auto">Số liệu thực tế trong khoảng thời gian đã chọn (Mục tiêu tính theo tháng bắt đầu)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Revenue KPI */}
                        <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">DOANH THU TỰ BÁN</span>
                                <TrendingUp size={16} className="text-blue-500"/>
                            </div>
                            <div className="text-2xl font-black text-blue-600 mb-4">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(stats.revenue)}</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                    <span>Mục tiêu tháng {new Date(dateRange.start).getMonth()+1}</span>
                                    <span className="text-gray-800">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(targets.revenue)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min((stats.revenue/targets.revenue)*100, 100)}%`}}></div>
                                </div>
                                <div className="text-right text-[10px] font-bold text-blue-600">{((stats.revenue/targets.revenue)*100).toFixed(1)}%</div>
                            </div>
                        </div>
                        {/* Appointment KPI */}
                        <div className="border border-purple-100 bg-purple-50/30 rounded-xl p-4">
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">CUỘC HẸN CÁ NHÂN</span>
                                <Calendar size={16} className="text-purple-500"/>
                            </div>
                            <div className="text-2xl font-black text-purple-600 mb-4">{stats.apps}</div>
                             <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                    <span>Mục tiêu tháng {new Date(dateRange.start).getMonth()+1}</span>
                                    <span className="text-gray-800">{targets.apps}</span>
                                </div>
                                <div className="h-1.5 w-full bg-purple-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{width: `${Math.min((stats.apps/targets.apps)*100, 100)}%`}}></div>
                                </div>
                                <div className="text-right text-[10px] font-bold text-purple-600">{((stats.apps/targets.apps)*100).toFixed(1)}%</div>
                            </div>
                        </div>
                        {/* Consultation KPI */}
                        <div className="border border-green-100 bg-green-50/30 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">TƯ VẤN CÁ NHÂN</span>
                                <MessageSquare size={16} className="text-green-500"/>
                            </div>
                            <div className="text-2xl font-black text-green-600 mb-4">{stats.cons}</div>
                             <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                    <span>Mục tiêu tháng {new Date(dateRange.start).getMonth()+1}</span>
                                    <span className="text-gray-800">{targets.cons}</span>
                                </div>
                                <div className="h-1.5 w-full bg-green-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{width: `${Math.min((stats.cons/targets.cons)*100, 100)}%`}}></div>
                                </div>
                                <div className="text-right text-[10px] font-bold text-green-600">{((stats.cons/targets.cons)*100).toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* Filters & Actions */}
                 <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center sticky top-2 z-20">
                    <div className="flex-1 w-full relative">
                        <input className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Tìm tên, số điện thoại, mã hợp đồng..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
                        <span className="text-[10px] font-bold text-gray-500 pl-2">Từ:</span>
                        <input type="date" className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none p-1" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                        <span className="text-gray-300">|</span>
                        <span className="text-[10px] font-bold text-gray-500">Đến:</span>
                        <input type="date" className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none p-1" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        {!isViewOnly && <button onClick={() => { setEditingApp({ date: new Date().toISOString().slice(0, 16), status: AppointmentStatus.NEW }); setAppModalOpen(true); }} className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-blue-700 transition-all flex items-center justify-center gap-1 shadow-lg shadow-blue-100"><Plus size={14} className="bg-white/20 rounded-full p-0.5"/> Hẹn mới</button>}
                        {!isViewOnly && <button onClick={() => { setEditingCons({ date: new Date().toISOString().slice(0, 16), type: ConsultationType.NEW, supportType: SupportType.SOLO }); setConsModalOpen(true); }} className="flex-1 md:flex-none px-4 py-2 bg-white text-green-600 border border-green-200 rounded-lg text-xs font-bold uppercase hover:bg-green-50 transition-all flex items-center justify-center gap-1"><Plus size={14}/> Tư vấn</button>}
                        {!isViewOnly && <button onClick={() => { setEditingRev({ date: new Date().toISOString().slice(0, 10), type: RevenueType.NEW }); setRevModalOpen(true); }} className="flex-1 md:flex-none px-4 py-2 bg-white text-orange-600 border border-orange-200 rounded-lg text-xs font-bold uppercase hover:bg-orange-50 transition-all flex items-center justify-center gap-1"><Plus size={14}/> Thu tiền</button>}
                    </div>
                 </div>

                 {/* Timeline List */}
                 <div>
                     {Object.keys(mergedData).map(dateKey => {
                         const items = mergedData[dateKey];
                         const dateObj = new Date(dateKey);
                         const isCollapsed = collapsedDates[dateKey];
                         const totalRevInGroup = items.filter(i => i.dataType === 'REV').reduce((s, i) => s + (i as Revenue).amountCollected, 0);
                         const appCount = items.filter(i => i.dataType === 'APP').length;
                         const consCount = items.filter(i => i.dataType === 'CONS').length;

                         return (
                             <div key={dateKey} className="mb-4">
                                 {/* Date Header */}
                                 <div className="flex items-center justify-between py-2 px-2 cursor-pointer select-none group" onClick={() => setCollapsedDates(prev => ({...prev, [dateKey]: !isCollapsed}))}>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase">NGÀY</div>
                                            <div className="text-2xl font-black text-blue-600 leading-none">{dateObj.getDate()}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase">THÁNG {dateObj.getMonth() + 1}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            {appCount > 0 && <span className="bg-purple-50 text-purple-600 border border-purple-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Calendar size={12}/> {appCount} Hẹn</span>}
                                            {consCount > 0 && <span className="bg-green-50 text-green-600 border border-green-100 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><MessageSquare size={12}/> {consCount} Tư vấn</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {totalRevInGroup > 0 && <span className="font-black text-orange-500 text-sm flex items-center gap-1 bg-white px-2 py-1 rounded border border-orange-100 shadow-sm"><DollarSign size={12}/> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevInGroup)}</span>}
                                        <div className="text-gray-300 group-hover:text-gray-500 transition-colors">
                                            {isCollapsed ? <ChevronDown size={20}/> : <ChevronUp size={20}/>}
                                        </div>
                                    </div>
                                 </div>
                                 
                                 {/* Items List */}
                                 {!isCollapsed && (
                                     <div className="space-y-3 pl-2 md:pl-0">
                                         {items.map(item => renderItem(item))}
                                     </div>
                                 )}
                             </div>
                         );
                     })}

                     {Object.keys(mergedData).length === 0 && (
                         <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                             <div className="text-gray-400 font-bold">Chưa có dữ liệu nào trong khoảng thời gian này</div>
                         </div>
                     )}
                 </div>
            </div>
        )}

        {/* View Mode: PROJECTS LIST (Restored & Enhanced) */}
        {viewMode === 'PROJECTS' && (
             <div className="space-y-4 animate-fadeIn">
                 {/* Header & Controls */}
                 <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                     <div>
                         <h3 className="font-bold text-gray-800 uppercase flex items-center gap-2"><Layers size={18} className="text-blue-600"/> CHI TIẾT HỢP ĐỒNG & DỰ ÁN</h3>
                         <div className="text-xs text-gray-400 font-medium">Quản lý {projects.length} dự án đang hoạt động</div>
                     </div>
                     <div className="flex gap-3">
                         <Button onClick={handleExportExcel} variant="outline" size="sm" className="font-bold text-green-600 border-green-200 hover:bg-green-50"><Download size={16} className="mr-2"/> XUẤT FILE EXCEL</Button>
                         {!isViewOnly && <Button onClick={() => { setEditingProj({}); setProjModalOpen(true); }} size="sm" className="shadow-lg shadow-blue-100 font-bold"><Plus size={16} className="mr-1"/> THÊM HỒ SƠ</Button>}
                     </div>
                 </div>

                 {/* Project List - Accordion Style */}
                 <div className="space-y-4">
                     {projects.length === 0 ? (
                         <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 italic">Chưa có hồ sơ dự án</div>
                     ) : (
                         projects.map(p => {
                             const isExpanded = expandedProjects[p.contractCode];
                             const relatedRevenues = revenues.filter(r => r.contractCode === p.contractCode);
                             const totalPaid = relatedRevenues.reduce((sum, r) => sum + r.amountCollected, 0);
                             const percent = p.contractValue ? Math.min((totalPaid / p.contractValue) * 100, 100) : 0;

                             return (
                                 <div key={p.contractCode} className="bg-white rounded-xl border border-gray-200 shadow-sm transition-all overflow-hidden">
                                     {/* Row Header - Always Visible */}
                                     <div 
                                         className={`flex flex-col md:flex-row items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors gap-4 ${isExpanded ? 'bg-gray-50 border-b border-gray-100' : ''}`}
                                         onClick={() => toggleProject(p.contractCode)}
                                     >
                                         {/* Col 1: Customer */}
                                         <div className="flex-1 w-full md:w-auto">
                                             <div className="text-xs text-gray-400 font-bold uppercase mb-1">KHÁCH HÀNG</div>
                                             <div className="font-bold text-gray-800 text-base">{p.customerName || '---'}</div>
                                             <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {p.phone || '---'}</div>
                                         </div>

                                         {/* Col 2: Project/Contract */}
                                         <div className="flex-1 w-full md:w-auto">
                                              <div className="text-xs text-gray-400 font-bold uppercase mb-1">DỰ ÁN & HỢP ĐỒNG</div>
                                              <div className="flex items-center gap-2">
                                                  <span className="font-mono font-bold text-blue-600">MÃ HĐ: {p.contractCode}</span>
                                              </div>
                                              <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/> {p.region || 'Chưa cập nhật KV'}</div>
                                         </div>

                                         {/* Col 3: Status */}
                                         <div className="w-full md:w-32">
                                             <div className="text-xs text-gray-400 font-bold uppercase mb-1">TRẠNG THÁI</div>
                                             <Badge variant={p.status === 'Hoàn thành' ? 'success' : 'info'}>{p.status || 'MỚI'}</Badge>
                                         </div>

                                         {/* Col 4: Financials */}
                                         <div className="w-full md:w-64 text-right">
                                              <div className="text-xs text-gray-400 font-bold uppercase mb-1">TÀI CHÍNH</div>
                                              <div className="font-black text-gray-800">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.contractValue || 0)}</div>
                                              <div className="text-xs font-bold text-green-600">Đã thu: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalPaid)}</div>
                                              <div className="h-1.5 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                                                  <div className="h-full bg-green-500" style={{width: `${percent}%`}}></div>
                                              </div>
                                         </div>

                                         {/* Toggle Icon */}
                                         <div className="text-gray-400">
                                             {isExpanded ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                                         </div>
                                     </div>

                                     {/* Expanded Details */}
                                     {isExpanded && (
                                         <div className="p-6 bg-white animate-fadeIn border-t border-gray-100">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                  {/* Section 1: Contact Info */}
                                                  <div className="space-y-4">
                                                      <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase text-xs border-b border-indigo-100 pb-2 mb-2">
                                                          <Building2 size={16}/> THÔNG TIN LIÊN HỆ
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Tên Công Ty / Doanh Nghiệp</label>
                                                          <input type="text" readOnly value={p.companyName || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-gray-700 p-2 border" />
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Email Khách Hàng</label>
                                                          <input type="text" readOnly value={p.email || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-gray-700 p-2 border" />
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Link Zalo Group (Hỗ trợ)</label>
                                                          <input type="text" readOnly value={p.zaloGroup || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-blue-600 p-2 border cursor-pointer hover:underline" onClick={() => p.zaloGroup && window.open(p.zaloGroup, '_blank')} />
                                                      </div>
                                                  </div>

                                                  {/* Section 2: Technical & Infra */}
                                                  <div className="space-y-4">
                                                      <div className="flex items-center gap-2 text-blue-600 font-bold uppercase text-xs border-b border-blue-100 pb-2 mb-2">
                                                          <Globe size={16}/> KỸ THUẬT & HẠ TẦNG
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Link Design / Demo</label>
                                                          <input type="text" readOnly value={p.designLink || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-blue-600 p-2 border cursor-pointer" />
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Link Website Chính Thức</label>
                                                          <input type="text" readOnly value={p.webLink || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-blue-600 p-2 border cursor-pointer" />
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Thông tin Hosting</label>
                                                          <input type="text" readOnly value={p.hostingSize || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-gray-700 p-2 border" placeholder="VD: 5GB - PA Việt Nam" />
                                                      </div>
                                                  </div>

                                                  {/* Section 3: Progress & Payment */}
                                                  <div className="space-y-4">
                                                      <div className="flex items-center gap-2 text-green-600 font-bold uppercase text-xs border-b border-green-100 pb-2 mb-2">
                                                          <DollarSign size={16}/> TIẾN ĐỘ & THANH TOÁN
                                                      </div>
                                                      <div className="grid grid-cols-2 gap-4">
                                                          <div className="space-y-1">
                                                              <label className="text-xs font-bold text-gray-500">Ngày ký</label>
                                                              <input type="text" readOnly value={p.signDate || p.contractCode.startsWith('HĐ') ? '---' : '---'} className="w-full text-sm border-gray-200 rounded bg-white text-gray-800 p-2 border text-center font-medium" placeholder="DD/MM/YYYY" />
                                                          </div>
                                                          <div className="space-y-1">
                                                              <label className="text-xs font-bold text-gray-500">Bàn giao</label>
                                                              <input type="text" readOnly value={p.handoverDate || ''} className="w-full text-sm border-gray-200 rounded bg-white text-gray-800 p-2 border text-center font-medium" />
                                                          </div>
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-xs font-bold text-gray-500">Nhân sự Ký chung (Hỗ trợ)</label>
                                                          <input type="text" readOnly value={p.jointSigner || ''} className="w-full text-sm border-gray-200 rounded bg-gray-50 text-gray-700 p-2 border" />
                                                      </div>

                                                      {/* Payment Detail List */}
                                                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-2">
                                                          <div className="text-[10px] font-black uppercase text-gray-400 mb-2 border-b border-gray-200 pb-1">CHI TIẾT THU TIỀN</div>
                                                          <div className="space-y-2 text-xs">
                                                              {relatedRevenues.map((r, idx) => (
                                                                  <div key={r.id} className="flex justify-between items-center">
                                                                      <span className="text-gray-600 font-medium">Lần {idx + 1} ({r.type}):</span>
                                                                      <span className="font-bold text-blue-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(r.amountCollected)}</span>
                                                                  </div>
                                                              ))}
                                                              {relatedRevenues.length === 0 && <span className="text-gray-400 italic">Chưa có dữ liệu thu tiền</span>}
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                              
                                              {/* Actions Footer */}
                                              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                                  <div className="text-xs text-gray-400 italic">
                                                      Mã hồ sơ: <span className="font-mono text-gray-600">{p.contractCode}</span>
                                                  </div>
                                                  {!isViewOnly && (
                                                      <div className="flex gap-2">
                                                          <button onClick={() => { setEditingProj(p); setProjModalOpen(true); }} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">CHỈNH SỬA HỒ SƠ</button>
                                                          <button onClick={() => handleDeleteProject(p.contractCode)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">XÓA</button>
                                                      </div>
                                                  )}
                                                  {isViewOnly && <div className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">HOÀN THÀNH</div>}
                                              </div>
                                         </div>
                                     )}
                                 </div>
                             );
                         })
                     )}
                 </div>
             </div>
        )}

      {/* --- MODALS (Keep existing logic) --- */}

      <Modal isOpen={isAppModalOpen} onClose={() => setAppModalOpen(false)} title="THÔNG TIN CUỘC HẸN">
          <div className="space-y-4 p-1">
              <Input label="Tên khách hàng" value={editingApp.customerName || ''} onChange={e => setEditingApp({...editingApp, customerName: e.target.value})} autoFocus />
              <div className="grid grid-cols-2 gap-4">
                   <Input label="Số điện thoại" value={editingApp.phone || ''} onChange={e => setEditingApp({...editingApp, phone: e.target.value})} onBlur={(e) => autofillCustomerInfo(e.target.value, 'APP')} />
                   <Input label="Tên công ty / Thương hiệu" value={editingApp.companyName || ''} onChange={e => setEditingApp({...editingApp, companyName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Thời gian hẹn" type="datetime-local" value={editingApp.date || ''} onChange={e => setEditingApp({...editingApp, date: e.target.value})} />
                  <Select label="Trạng thái" options={Object.values(AppointmentStatus).map(s => ({value: s, label: s}))} value={editingApp.status || AppointmentStatus.NEW} onChange={e => setEditingApp({...editingApp, status: e.target.value as AppointmentStatus})} />
              </div>
              <Combobox label="Tỉnh / Thành phố" value={editingApp.location || ''} onChange={val => setEditingApp({...editingApp, location: val})} options={VIETNAM_PROVINCES} />
              <Input label="Địa chỉ chi tiết" value={editingApp.addressDetail || ''} onChange={e => setEditingApp({...editingApp, addressDetail: e.target.value})} />
              <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ghi chú thêm</label>
                  <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm h-24" value={editingApp.notes || ''} onChange={e => setEditingApp({...editingApp, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <Button variant="ghost" onClick={() => setAppModalOpen(false)}>Hủy</Button>
                  <Button onClick={handleSaveApp} className="px-6">Lưu Cuộc Hẹn</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isConsModalOpen} onClose={() => setConsModalOpen(false)} title="PHIẾU TƯ VẤN KHÁCH HÀNG">
          <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Ngày tư vấn" type="date" value={editingCons.date ? editingCons.date.substring(0, 10) : ''} onChange={e => setEditingCons({...editingCons, date: e.target.value})} />
                  <Input label="Số điện thoại" value={editingCons.phone || ''} onChange={e => setEditingCons({...editingCons, phone: e.target.value})} onBlur={(e) => autofillCustomerInfo(e.target.value, 'CONS')} />
              </div>
              <Input label="Tên khách hàng" value={editingCons.customerName || ''} onChange={e => setEditingCons({...editingCons, customerName: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <Select label="Loại hình" options={Object.values(ConsultationType).map(t => ({value: t, label: t}))} value={editingCons.type || ConsultationType.NEW} onChange={e => setEditingCons({...editingCons, type: e.target.value as ConsultationType})} />
                  <Select label="Hình thức hỗ trợ" options={Object.values(SupportType).map(t => ({value: t, label: t}))} value={editingCons.supportType || SupportType.SOLO} onChange={e => setEditingCons({...editingCons, supportType: e.target.value as SupportType})} />
              </div>
              {editingCons.supportType !== SupportType.SOLO && (
                  <Input label="Người hỗ trợ (Tên)" value={editingCons.supportPersonName || ''} onChange={e => setEditingCons({...editingCons, supportPersonName: e.target.value})} placeholder="Nhập tên người hỗ trợ..." />
              )}
              <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nội dung tư vấn</label>
                  <textarea className="w-full border border-gray-300 rounded-md p-2 text-sm h-24" value={editingCons.notes || ''} onChange={e => setEditingCons({...editingCons, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <Button variant="ghost" onClick={() => setConsModalOpen(false)}>Hủy</Button>
                  <Button onClick={handleSaveCons} className="px-6">Lưu Phiếu</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isRevModalOpen} onClose={() => setRevModalOpen(false)} title="GHI NHẬN DOANH THU">
          <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Mã Hợp Đồng (Bắt buộc)" value={editingRev.contractCode || ''} onChange={e => setEditingRev({...editingRev, contractCode: e.target.value.toUpperCase()})} placeholder="VD: HĐ001" />
                  <Input label="Ngày thu tiền" type="date" value={editingRev.date ? editingRev.date.substring(0, 10) : ''} onChange={e => setEditingRev({...editingRev, date: e.target.value})} />
              </div>
              <Input label="Tên khách hàng / Đại diện" value={editingRev.customerName || ''} onChange={e => setEditingRev({...editingRev, customerName: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <Select label="Loại doanh thu" options={Object.values(RevenueType).map(t => ({value: t, label: t}))} value={editingRev.type || RevenueType.NEW} onChange={e => setEditingRev({...editingRev, type: e.target.value as RevenueType})} />
                  <Input label="Số tiền thu (VNĐ)" type="number" value={editingRev.amountCollected || 0} onChange={e => setEditingRev({...editingRev, amountCollected: Number(e.target.value)})} />
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-700">
                  <b>Lưu ý:</b> Nếu là "Ký mới", hệ thống sẽ tự động tạo một Hồ sơ dự án tương ứng nếu chưa tồn tại. Vui lòng cập nhật chi tiết dự án sau.
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <Button variant="ghost" onClick={() => setRevModalOpen(false)}>Hủy</Button>
                  <Button onClick={handleSaveRev} className="px-6">Xác Nhận Thu</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isProjModalOpen} onClose={() => setProjModalOpen(false)} title="CẬP NHẬT HỒ SƠ DỰ ÁN">
            <div className="space-y-4 p-1 max-h-[70vh] overflow-y-auto pr-2">
                <div className="bg-gray-100 p-3 rounded-lg text-sm font-bold text-gray-700 flex justify-between">
                    <span>Mã Hợp Đồng: {editingProj.contractCode}</span>
                    <span className="text-green-600">Giá trị: {new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(editingProj.contractValue || 0)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Tên Khách hàng" value={editingProj.customerName || ''} onChange={e => setEditingProj({...editingProj, customerName: e.target.value})} />
                    <Input label="Số điện thoại" value={editingProj.phone || ''} onChange={e => setEditingProj({...editingProj, phone: e.target.value})} onBlur={(e) => autofillCustomerInfo(e.target.value, 'PROJ')} />
                </div>
                <Input label="Tên Công ty / Thương hiệu" value={editingProj.companyName || ''} onChange={e => setEditingProj({...editingProj, companyName: e.target.value})} />
                <Input label="Địa chỉ" value={editingProj.address || ''} onChange={e => setEditingProj({...editingProj, address: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Lĩnh vực kinh doanh" value={editingProj.industry || ''} onChange={e => setEditingProj({...editingProj, industry: e.target.value})} />
                    <Combobox label="Khu vực" value={editingProj.region || ''} onChange={val => setEditingProj({...editingProj, region: val})} options={VIETNAM_PROVINCES} />
                </div>

                <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-sm font-black text-gray-800 uppercase mb-3">Thông tin triển khai</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                         <Input label="Link Web Demo/Chính thức" value={editingProj.webLink || ''} onChange={e => setEditingProj({...editingProj, webLink: e.target.value})} placeholder="https://..." />
                         <Input label="Mật khẩu Web (nếu có)" value={editingProj.webPassword || ''} onChange={e => setEditingProj({...editingProj, webPassword: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                         <Input label="Link Design (Figma/Image)" value={editingProj.designLink || ''} onChange={e => setEditingProj({...editingProj, designLink: e.target.value})} placeholder="https://..." />
                         <Input label="Gói Hosting (Dung lượng)" value={editingProj.hostingSize || ''} onChange={e => setEditingProj({...editingProj, hostingSize: e.target.value})} />
                    </div>
                    <Input label="Link/Tên Zalo Group hỗ trợ" value={editingProj.zaloGroup || ''} onChange={e => setEditingProj({...editingProj, zaloGroup: e.target.value})} />
                </div>

                <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-sm font-black text-gray-800 uppercase mb-3">Tiến độ</h4>
                     <div className="grid grid-cols-2 gap-4 mb-3">
                         <Input label="Ngày ký" type="date" value={editingProj.signDate || ''} onChange={e => setEditingProj({...editingProj, signDate: e.target.value})} />
                         <Input label="Ngày bàn giao dự kiến/thực tế" type="date" value={editingProj.handoverDate || ''} onChange={e => setEditingProj({...editingProj, handoverDate: e.target.value})} />
                    </div>
                    <Input label="Người ký chung (nếu có)" value={editingProj.jointSigner || ''} onChange={e => setEditingProj({...editingProj, jointSigner: e.target.value})} />
                </div>

                <div className="flex items-center justify-between pt-4 border-t mt-4">
                     {editingProj.contractCode && projects.some(p => p.contractCode === editingProj.contractCode) && !isViewOnly ? (
                        <button 
                            onClick={() => handleDeleteProject(editingProj.contractCode!)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold"
                            type="button"
                        >
                            <Trash2 size={18} /> <span className="hidden sm:inline">Xóa hồ sơ</span>
                        </button>
                     ) : <div></div>}
                     <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => setProjModalOpen(false)}>Hủy</Button>
                        <Button onClick={handleSaveProject} className="px-6">Lưu Hồ Sơ</Button>
                     </div>
                </div>
            </div>
        </Modal>
    </div>
  );
};
