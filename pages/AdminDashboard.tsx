
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { storageService } from '../services/storageService';
import { User, Department, Appointment, Revenue, Message, UserRole, ROLE_RANK, ROLE_LABELS, DepartmentLevel, ProjectProfile, ActivityLog, Consultation } from '../types';
import { Button, Input, Modal, Select, Card, Badge, Combobox } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, TrendingUp, Calendar, Edit, Trash2, Eye, ArrowLeft, Send, MessageSquare, Search, LayoutGrid, Loader2, GitMerge, CornerDownRight, CheckCircle, Filter, Briefcase, Building2, Crown, UserCircle, Users as UsersIcon, X, ChevronRight, Trophy, AlertTriangle, RotateCcw, ShieldAlert, Activity, AlertOctagon } from 'lucide-react';
import { EmployeeDashboard } from './EmployeeDashboard';

interface AdminDashboardProps {
    currentUser: User; 
}

// Helper interface for tree structure
interface StructuredUser extends User {
    _depth: number;
    _isManager?: boolean;
    _deptName?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const manager = currentUser;
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'personal' | 'dashboard' | 'staff' | 'depts' | 'chat' | 'logs'>('dashboard');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allRevenues, setAllRevenues] = useState<Revenue[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allConsultations, setAllConsultations] = useState<Consultation[]>([]); // Added Consultation State
  const [allProjects, setAllProjects] = useState<ProjectProfile[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // --- TOP 10 TAB STATE ---
  const [top10Tab, setTop10Tab] = useState<'COMPANY' | 'REGION'>('REGION');

  // --- DELETE UNDO STATE ---
  const [undoState, setUndoState] = useState<{ id: string } | null>(null);
  const [undoCountDown, setUndoCountDown] = useState(0);

  // --- DATE FILTER STATE (Default: Current Month) ---
  const [startDate, setStartDate] = useState(() => {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // --- MULTI-LEVEL FILTER STATE ---
  const [filterRegion, setFilterRegion] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterRole, setFilterRole] = useState(''); 

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [chatFilterRole, setChatFilterRole] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isMsgModalOpen, setMsgModalOpen] = useState(false);
  const [msgContent, setMsgContent] = useState('');
  const [msgTargetType, setMsgTargetType] = useState<'ALL' | 'DEPT' | 'USER'>('ALL');
  const [msgTargetId, setMsgTargetId] = useState('');

  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formUser, setFormUser] = useState<Partial<User> & { 
      newDeptName?: string, 
      newDeptParentId?: string 
  }>({});

  const [isDeptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [formDept, setFormDept] = useState<Partial<Department>>({ level: DepartmentLevel.DEPARTMENT });

  const [viewingUser, setViewingUser] = useState<User | null>(null);
  
  const myRank = ROLE_RANK[manager.role];
  const canEditStructure = myRank >= 4;

  const refreshData = async () => {
      setLoading(true);
      try {
          const [u, d, r, a, cons, m, p, act] = await Promise.all([
              storageService.getUsers(),
              storageService.getDepartments(),
              storageService.getRevenues(),
              storageService.getAppointments(),
              storageService.getConsultations(), // Fetch Consultations
              storageService.getMessages(),
              storageService.getProjects(),
              // Fetch only current user's activities
              storageService.getActivities(currentUser.id)
          ]);
          setAllUsers(u);
          setDepartments(d);
          setAllRevenues(r);
          setAllAppointments(a);
          setAllConsultations(cons); // Set Consultations
          setAllMessages(m);
          setAllProjects(p);
          setActivities(act);
      } catch (error) {
          console.error("Failed to load data", error);
      } finally {
          setLoading(false);
      }
  };

  const silentRefreshMsg = async () => {
      const m = await storageService.getMessages();
      setAllMessages(m);
  };

  useEffect(() => {
     refreshData();
     const interval = setInterval(() => {
         silentRefreshMsg();
     }, 10000); 
     return () => clearInterval(interval);
  }, []);

  // --- AUTO-FILL HIERARCHY BASED ON USER ROLE ---
  useEffect(() => {
      if (departments.length === 0 || !manager.departmentId) return;

      const fillHierarchy = (deptId: string) => {
          const dept = departments.find(d => d.id === deptId);
          if (!dept) return;

          // Recursively find parents
          const ancestors: Record<string, string> = {}; 
          let current = dept;
          // Put current first
          if (current.level === DepartmentLevel.REGION) setFilterRegion(current.id);
          if (current.level === DepartmentLevel.GROUP) setFilterGroup(current.id);
          if (current.level === DepartmentLevel.DEPARTMENT) setFilterDept(current.id);
          if (current.level === DepartmentLevel.TEAM) setFilterTeam(current.id);

          // Trace up
          let safety = 0;
          while (current.parentId && safety < 10) {
              const parent = departments.find(d => d.id === current.parentId);
              if (parent) {
                  if (parent.level === DepartmentLevel.REGION) setFilterRegion(parent.id);
                  if (parent.level === DepartmentLevel.GROUP) setFilterGroup(parent.id);
                  if (parent.level === DepartmentLevel.DEPARTMENT) setFilterDept(parent.id);
                  current = parent;
              } else {
                  break;
              }
              safety++;
          }
      };

      fillHierarchy(manager.departmentId);
  }, [departments, manager.departmentId]);

  // UNDO TIMER & EXECUTION EFFECT
  useEffect(() => {
      if (!undoState) return;

      if (undoCountDown > 0) {
          const timer = setTimeout(() => setUndoCountDown(c => c - 1), 1000);
          return () => clearTimeout(timer);
      } else {
          // Fix: Execute delete strictly when countdown hits 0
          const executeDelete = async () => {
              try {
                  await storageService.deleteDepartment(undoState.id);
                  // Refresh ONLY after delete is confirmed finished
                  await refreshData();
              } catch(e: any) {
                  alert("Lỗi xóa: " + e.message);
              } finally {
                  setUndoState(null);
              }
          };
          executeDelete();
      }
  }, [undoCountDown, undoState]);

  useEffect(() => {
     if(activeTab === 'chat' && selectedChatUser) {
         chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
     }
  }, [allMessages, selectedChatUser, activeTab]);

  // --- STRICT SUBORDINATE LOGIC ---
  const mySubordinates = useMemo(() => {
      if (manager.role === UserRole.DIRECTOR) {
          return allUsers; 
      }

      if (myRank <= 1) return [manager];

      const visibleUserIds = new Set<string>();
      const managedDeptIds = new Set<string>();
      
      const directDepts = departments.filter(d => d.managerId === manager.id);
      
      const deptQueue = [...directDepts];
      while (deptQueue.length > 0) {
          const curr = deptQueue.pop()!;
          managedDeptIds.add(curr.id);
          const children = departments.filter(d => d.parentId === curr.id);
          deptQueue.push(...children);
      }

      allUsers.forEach(u => {
          if (u.departmentId && managedDeptIds.has(u.departmentId)) {
               if (u.id !== manager.id) visibleUserIds.add(u.id);
          }
      });
      
      departments.forEach(d => {
          if (managedDeptIds.has(d.id) && d.managerId && d.managerId !== manager.id) {
              visibleUserIds.add(d.managerId);
          }
      });

      const result = allUsers.filter(u => visibleUserIds.has(u.id));
      return [manager, ...result];
  }, [allUsers, departments, manager, myRank]);

  // --- TREE SORT LOGIC (HIERARCHICAL) ---
  const structuredUsers = useMemo(() => {
      if (mySubordinates.length <= 1) return []; 

      const result: StructuredUser[] = [];
      const processedUserIds = new Set<string>();
      
      const getDeptWeight = (level?: DepartmentLevel) => {
        switch(level) {
            case DepartmentLevel.HQ: return 5;
            case DepartmentLevel.REGION: return 4;
            case DepartmentLevel.GROUP: return 3;
            case DepartmentLevel.DEPARTMENT: return 2;
            case DepartmentLevel.TEAM: return 1;
            default: return 0;
        }
      };

      const traverse = (deptId: string, depth: number) => {
          const dept = departments.find(d => d.id === deptId);
          if (!dept) return;

          if (dept.managerId && dept.managerId !== manager.id && !processedUserIds.has(dept.managerId)) {
              const mgr = mySubordinates.find(u => u.id === dept.managerId);
              if (mgr) {
                  result.push({ ...mgr, _depth: depth, _isManager: true, _deptName: dept.name });
                  processedUserIds.add(mgr.id);
              }
          }

          const employees = mySubordinates.filter(u => 
              u.departmentId === deptId && 
              u.id !== dept.managerId && 
              u.id !== manager.id &&
              !processedUserIds.has(u.id)
          ).sort((a, b) => a.name.localeCompare(b.name));

          employees.forEach(emp => {
              result.push({ ...emp, _depth: depth + 1, _isManager: false, _deptName: dept.name });
              processedUserIds.add(emp.id);
          });

          const subDepts = departments
              .filter(d => d.parentId === deptId)
              .sort((a, b) => (getDeptWeight(b.level) - getDeptWeight(a.level)) || a.name.localeCompare(b.name));

          subDepts.forEach(sub => traverse(sub.id, depth + 1));
      };

      const rootDepts = departments.filter(d => d.managerId === manager.id);
      
      if (rootDepts.length > 0) {
          rootDepts.forEach(d => traverse(d.id, 0));
      } else {
          if (manager.role === UserRole.DIRECTOR) {
               const hq = departments.find(d => d.level === DepartmentLevel.HQ);
               if(hq) traverse(hq.id, 0);
          }
      }

      const orphans = mySubordinates.filter(u => !processedUserIds.has(u.id) && u.id !== manager.id);
      orphans.forEach(u => result.push({ ...u, _depth: 0, _isManager: false, _deptName: 'Chưa phân bổ / Khác' }));

      return result;
  }, [mySubordinates, departments, manager]);

  // --- HIERARCHY FILTER LOGIC ---
  const regionOptions = useMemo(() => departments.filter(d => d.level === DepartmentLevel.REGION), [departments]);
  const groupOptions = useMemo(() => !filterRegion ? [] : departments.filter(d => d.level === DepartmentLevel.GROUP && d.parentId === filterRegion), [departments, filterRegion]);
  const deptOptions = useMemo(() => !filterGroup ? [] : departments.filter(d => d.level === DepartmentLevel.DEPARTMENT && d.parentId === filterGroup), [departments, filterGroup]);
  const teamOptions = useMemo(() => !filterDept ? [] : departments.filter(d => d.level === DepartmentLevel.TEAM && d.parentId === filterDept), [departments, filterDept]);

  // --- ORPHAN/ERROR DEPTS (Ghosts) ---
  const orphanDepts = useMemo(() => {
      // Find departments that are NOT HQ, but have no parent, OR have no level (undefined)
      return departments.filter(d => (d.level !== DepartmentLevel.HQ && !d.parentId) || !d.level);
  }, [departments]);

  // Auto-clear children filters when parent filter changes (Only if not set by auto-fill logic implicitly, but React batching handles this)
  useEffect(() => { 
      if (!groupOptions.some(g => g.id === filterGroup)) setFilterGroup(''); 
  }, [filterRegion, groupOptions]);
  useEffect(() => { 
      if (!deptOptions.some(d => d.id === filterDept)) setFilterDept(''); 
  }, [filterGroup, deptOptions]);
  useEffect(() => { 
      if (!teamOptions.some(t => t.id === filterTeam)) setFilterTeam(''); 
  }, [filterDept, teamOptions]);
  useEffect(() => { setFilterUser(''); }, [filterTeam]);

  // --- HELPER: CHECK DATE RANGE ---
  const isInRange = (dateStr: string) => {
      if (!dateStr) return false;
      const d = dateStr.split('T')[0];
      return d >= startDate && d <= endDate;
  };

  // --- DASHBOARD DATA CALCULATION ---
  const dashboardStats = useMemo(() => {
      // 1. Personal Stats
      const myRevenues = allRevenues.filter(r => r.userId === manager.id && isInRange(r.date));
      const myAppointments = allAppointments.filter(a => a.userId === manager.id && isInRange(a.date));
      const myConsultations = allConsultations.filter(c => c.userId === manager.id && isInRange(c.date)); // Added
      const myTotalRevenue = myRevenues.reduce((s, r) => s + r.amountCollected, 0); 
      
      // 2. Team Stats (Hierarchical)
      let targetUserIds = new Set<string>();
      const scopeId = filterTeam || filterDept || filterGroup || filterRegion;

      if (filterUser) {
          targetUserIds.add(filterUser);
      } else if (scopeId) {
          // Recursive collection of ALL descendant departments under the selected scope
          const validDeptIds = new Set<string>();
          const collectDepts = (rootId: string) => {
              validDeptIds.add(rootId);
              departments.filter(d => d.parentId === rootId).forEach(c => collectDepts(c.id));
          };
          collectDepts(scopeId);

          mySubordinates.forEach(u => {
              if (u.id === manager.id) return; 
              if (u.departmentId && validDeptIds.has(u.departmentId)) {
                  targetUserIds.add(u.id);
              }
          });
           departments.forEach(d => {
              if (validDeptIds.has(d.id) && d.managerId && d.managerId !== manager.id) {
                  if (mySubordinates.some(sub => sub.id === d.managerId)) {
                      targetUserIds.add(d.managerId);
                  }
              }
          });
      } else {
          mySubordinates.forEach(u => { if(u.id !== manager.id) targetUserIds.add(u.id); });
      }
      const validTargetIds = new Set([...targetUserIds]); 
      const teamRevenues = allRevenues.filter(r => validTargetIds.has(r.userId) && isInRange(r.date));
      const teamAppointments = allAppointments.filter(a => validTargetIds.has(a.userId) && isInRange(a.date));
      const teamConsultations = allConsultations.filter(c => validTargetIds.has(c.userId) && isInRange(c.date)); // Added
      const teamTotalRevenue = teamRevenues.reduce((s, r) => s + r.amountCollected, 0);

      // 3. Top Employees Calculation
      
      // A. Global (Whole Company) - Always correct
      const empRevMapGlobal: Record<string, number> = {};
      allRevenues.filter(r => isInRange(r.date)).forEach(r => {
          empRevMapGlobal[r.userId] = (empRevMapGlobal[r.userId] || 0) + r.amountCollected;
      });
      const topEmployeesGlobal = Object.entries(empRevMapGlobal)
        .map(([uid, val]) => ({ name: allUsers.find(u => u.id === uid)?.name || uid, value: val, id: uid }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 10);

      // B. Regional / Filtered Scope (FIXED LOGIC)
      let regionTargetIds = new Set<string>();

      // Step 1: Determine the "Root Region ID" context
      let currentRegionId = filterRegion;
      
      if (!currentRegionId) {
          if (manager.role === UserRole.DIRECTOR) {
          } else {
              let currDept = departments.find(d => d.id === manager.departmentId);
              if (!currDept) {
                  const managedDept = departments.find(d => d.managerId === manager.id);
                  if (managedDept) currDept = managedDept;
              }
              let tempDept = currDept;
              let safety = 0;
              while (tempDept && tempDept.level !== DepartmentLevel.REGION && safety < 10) {
                  if (tempDept.parentId) {
                       tempDept = departments.find(d => d.id === tempDept!.parentId);
                  } else {
                      break;
                  }
                  safety++;
              }
              if (tempDept && tempDept.level === DepartmentLevel.REGION) {
                  currentRegionId = tempDept.id;
              }
          }
      }

      if (currentRegionId) {
          const regionDeptIds = new Set<string>();
          const collectDepts = (rootId: string) => {
              regionDeptIds.add(rootId);
              departments.filter(d => d.parentId === rootId).forEach(c => collectDepts(c.id));
          };
          collectDepts(currentRegionId);

          allUsers.forEach(u => {
              if (u.departmentId && regionDeptIds.has(u.departmentId)) {
                  regionTargetIds.add(u.id);
              }
              const managedDept = departments.find(d => d.managerId === u.id);
              if (managedDept && regionDeptIds.has(managedDept.id)) {
                  regionTargetIds.add(u.id);
              }
          });
      } else {
          regionTargetIds = validTargetIds;
          if (!filterUser) regionTargetIds.add(manager.id);
      }

      const empRevMapLocal: Record<string, number> = {};
      allRevenues.filter(r => regionTargetIds.has(r.userId) && isInRange(r.date)).forEach(r => {
          empRevMapLocal[r.userId] = (empRevMapLocal[r.userId] || 0) + r.amountCollected;
      });

      const topEmployeesLocal = Object.entries(empRevMapLocal)
        .map(([uid, val]) => ({ name: allUsers.find(u => u.id === uid)?.name || uid, value: val, id: uid }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 10);

      const chartRevenues = [...myRevenues, ...teamRevenues];
      const monthlyData: Record<string, number> = {};
      chartRevenues.forEach(r => {
          const month = r.date.substring(0, 7);
          monthlyData[month] = (monthlyData[month] || 0) + r.amountCollected;
      });
      const chartData = Object.keys(monthlyData).sort().map(k => ({ name: k, revenue: monthlyData[k] }));
      
      let conclusion = "Số liệu trong khoảng thời gian này.";

      return {
          personal: { revenue: myTotalRevenue, apps: myAppointments.length, cons: myConsultations.length, user: manager },
          team: { revenue: teamTotalRevenue, apps: teamAppointments.length, cons: teamConsultations.length, count: validTargetIds.size },
          chartData, conclusion, topEmployeesGlobal, topEmployeesLocal
      };

  }, [allRevenues, allAppointments, allConsultations, manager, filterUser, filterTeam, filterDept, filterGroup, filterRegion, mySubordinates, startDate, endDate, allUsers, departments]);

  const getCumulativeHeadcount = (deptId: string): number => {
      const uniqueUserIds = new Set<string>();
      const collectUsers = (currentDeptId: string) => {
          const currentDept = departments.find(d => d.id === currentDeptId);
          if (currentDept && currentDept.managerId) uniqueUserIds.add(currentDept.managerId);
          allUsers.filter(u => u.departmentId === currentDeptId).forEach(u => uniqueUserIds.add(u.id));
          departments.filter(d => d.parentId === currentDeptId).forEach(child => collectUsers(child.id));
      };
      collectUsers(deptId);
      return uniqueUserIds.size;
  };

  const chatUsers = useMemo(() => {
      // 1. Search Mode: Search EVERYONE in the system by Name or ID
      if (chatSearchTerm) {
          const term = chatSearchTerm.toLowerCase();
          return allUsers.filter(u => 
              u.id !== manager.id && 
              (u.name.toLowerCase().includes(term) || u.id.toLowerCase().includes(term))
          );
      }

      // 2. Default Mode: History + Same Department
      const interactedUserIds = new Set<string>();
      
      // A. History: Users who have exchanged messages
      allMessages.forEach(m => {
          if (m.senderId === manager.id && m.receiverId !== 'ADMIN' && typeof m.receiverId === 'string') {
              interactedUserIds.add(m.receiverId);
          }
          if (m.receiverId === manager.id) {
              interactedUserIds.add(m.senderId);
          }
      });

      // B. Same Department: Users in the exact same department
      if (manager.departmentId) {
          allUsers.forEach(u => {
              if (u.departmentId === manager.departmentId && u.id !== manager.id) {
                  interactedUserIds.add(u.id);
              }
          });
      }

      // Filter users based on the Set
      let filtered = allUsers.filter(u => interactedUserIds.has(u.id));

      if (chatFilterRole) filtered = filtered.filter(u => u.role === chatFilterRole);
      return filtered;
  }, [allUsers, allMessages, manager.id, manager.departmentId, chatSearchTerm, chatFilterRole]);

  const currentConversation = useMemo(() => {
      if (!selectedChatUser) return [];
      return allMessages.filter(m => {
          const isMeSender = m.senderId === manager.id;
          const isMeReceiver = m.receiverId === manager.id || (manager.role === UserRole.DIRECTOR && m.receiverId === 'ADMIN');
          const isOtherSender = m.senderId === selectedChatUser;
          const isOtherReceiver = m.receiverId === selectedChatUser;
          if (isMeSender && isOtherReceiver) return true;
          if (isOtherSender && isMeReceiver) return true;
          return false;
      }).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allMessages, selectedChatUser, manager.id, manager.role]);

  const handleAdminReply = async () => {
      if (!selectedChatUser || !adminChatInput.trim()) return;
      const newMsg: Message = { id: `MSG${Date.now()}`, senderId: manager.id, senderName: manager.name, receiverId: selectedChatUser, content: adminChatInput, timestamp: new Date().toISOString(), isRead: false };
      setAllMessages(prev => [...prev, newMsg]); setAdminChatInput('');
      await storageService.sendMessage(newMsg);
  };

  const handleSendMessage = async () => {
      if (!msgContent) return;
      let receiverIds: string[] = [];
      if (msgTargetType === 'ALL') {
          receiverIds = mySubordinates.filter(u => u.id !== manager.id).map(u => u.id);
      } else if (msgTargetType === 'USER') {
          if (msgTargetId) receiverIds = [msgTargetId];
      } else if (msgTargetType === 'DEPT') {
          if (msgTargetId) {
             const targetDeptIds = new Set<string>();
             const collectDepts = (dId: string) => {
                 targetDeptIds.add(dId);
                 departments.filter(d => d.parentId === dId).forEach(c => collectDepts(c.id));
             };
             collectDepts(msgTargetId);
             mySubordinates.forEach(u => {
                 if (u.departmentId && targetDeptIds.has(u.departmentId) && u.id !== manager.id) {
                     receiverIds.push(u.id);
                 }
                 departments.forEach(d => { if(targetDeptIds.has(d.id) && d.managerId && d.managerId !== manager.id) receiverIds.push(d.managerId); });
             });
             receiverIds = [...new Set(receiverIds)];
          }
      }
      if (receiverIds.length === 0) return alert("Không tìm thấy người nhận phù hợp!");
      await storageService.sendMessage({ id: `MSG${Date.now()}`, senderId: manager.id, senderName: manager.name, receiverId: receiverIds, content: msgContent, timestamp: new Date().toISOString(), isRead: false });
      alert(`Đã gửi thông báo thành công cho ${receiverIds.length} nhân sự!`); setMsgModalOpen(false); setMsgContent(''); silentRefreshMsg();
  };

  const calculateTotalRevenue = (user: User) => {
      const earned = allRevenues.filter(r => r.userId === user.id).reduce((s, r) => s + r.amountCollected, 0);
      return earned + (user.initialRevenue || 0);
  };

  const openAddUser = () => { setEditingUserId(null); setFormUser({ role: UserRole.EMPLOYEE, initialRevenue: 0, managerId: manager.id }); setUserModalOpen(true); };
  const openEditUser = (user: User) => { setEditingUserId(user.id); setFormUser({ ...user }); setUserModalOpen(true); };
  
  const handleSubmitUser = async () => {
    if (!formUser.id || !formUser.name || !formUser.password) return alert("Vui lòng điền đủ thông tin");
    const targetRank = ROLE_RANK[formUser.role as UserRole];
    if (manager.role !== UserRole.DIRECTOR && targetRank > myRank) return alert("Cấp bậc không hợp lệ.");
    
    const isManagerRole = [UserRole.REGIONAL_MANAGER, UserRole.GROUP_MANAGER, UserRole.MANAGER, UserRole.TEAM_LEADER].includes(formUser.role as UserRole);

    try {
        let finalDeptId = formUser.departmentId;

        // AUTOMATIC DEPARTMENT CREATION FOR MANAGERS
        if (isManagerRole && !editingUserId) {
             // 1. Determine Level based on Role
             const deptLevelMap: Record<string, DepartmentLevel> = {
                [UserRole.REGIONAL_MANAGER]: DepartmentLevel.REGION,
                [UserRole.GROUP_MANAGER]: DepartmentLevel.GROUP,
                [UserRole.MANAGER]: DepartmentLevel.DEPARTMENT,
                [UserRole.TEAM_LEADER]: DepartmentLevel.TEAM
             };
             const targetLevel = deptLevelMap[formUser.role as string];

             // 2. If user is creating a manager but hasn't assigned them to an EXISTING dept as a leader,
             //    we assume we need to create a NEW department for them to lead.
             //    Also validate if Parent ID is required (Region usually doesn't need parent, others do).
             if (!formUser.departmentId) {
                 if (targetLevel !== DepartmentLevel.REGION && !formUser.newDeptParentId) {
                     return alert(`Để tạo ${ROLE_LABELS[formUser.role as UserRole]}, vui lòng chọn "Trực thuộc đơn vị cấp trên" để hệ thống tạo nhóm/phòng tương ứng.`);
                 }

                 // 3. Check if Department ID already exists (Reuse instead of Create)
                 const newDeptId = `${targetLevel.substring(0,3).toUpperCase()}_${formUser.id}`; 
                 const existingDept = departments.find(d => d.id === newDeptId);

                 if (existingDept) {
                     // Department Exists -> Reuse it
                     finalDeptId = newDeptId;
                     // Update Manager Info on Existing Dept to ensure consistency
                     if (existingDept.managerId !== formUser.id) {
                         await storageService.updateDepartment({
                             ...existingDept,
                             managerId: formUser.id,
                             managerName: formUser.name
                         });
                     }
                 } else {
                     // Department Doesn't Exist -> Create New
                     const autoDeptName = formUser.newDeptName || `${targetLevel} ${formUser.name}`;
                     await storageService.addDepartment({
                         id: newDeptId, 
                         name: autoDeptName, 
                         level: targetLevel, 
                         managerId: formUser.id, 
                         managerName: formUser.name, 
                         parentId: formUser.newDeptParentId || (targetLevel === DepartmentLevel.REGION ? 'HQ' : null)
                     });
                     finalDeptId = newDeptId;
                 }
             }
        } else if (!isManagerRole && !formUser.departmentId && !editingUserId) {
            // Normal employee must have a department
             return alert("Vui lòng chọn đơn vị trực thuộc cho nhân viên.");
        }

        const userData = { ...formUser, departmentId: finalDeptId };
        // Cleanup temp fields
        delete userData.newDeptName; 
        delete userData.newDeptParentId;

        if (editingUserId) await storageService.updateUser(userData as User);
        else await storageService.addUser({ ...userData, managerId: manager.id } as User);
        
        await refreshData(); 
        setUserModalOpen(false);
    } catch (e: any) { alert(e.message); }
  };
  
  const handleDeleteUser = async (id: string) => { if(confirm("Xóa nhân viên này?")) { try { await storageService.deleteUser(id); await refreshData(); } catch(e: any) { alert(e.message); } } };
  
  const openAddDept = () => { setEditingDeptId(null); setFormDept({ level: DepartmentLevel.DEPARTMENT }); setDeptModalOpen(true); };
  const getAvailableParents = (currentLevel?: DepartmentLevel) => {
     if (!currentLevel || currentLevel === DepartmentLevel.HQ) return [];
     let allowedParentLevels: DepartmentLevel[] = [];
     switch (currentLevel) {
         case DepartmentLevel.REGION: allowedParentLevels = [DepartmentLevel.HQ]; break;
         case DepartmentLevel.GROUP: allowedParentLevels = [DepartmentLevel.REGION]; break;
         case DepartmentLevel.DEPARTMENT: allowedParentLevels = [DepartmentLevel.GROUP, DepartmentLevel.REGION]; break;
         case DepartmentLevel.TEAM: allowedParentLevels = [DepartmentLevel.DEPARTMENT, DepartmentLevel.GROUP, DepartmentLevel.REGION]; break;
     }
     return departments.filter(d => allowedParentLevels.includes(d.level));
  };
  const handleSubmitDept = async () => {
      try {
        if (!formDept.id || !formDept.name) throw new Error("Thiếu ID hoặc Tên phòng");
        if (!formDept.level) throw new Error("Chưa chọn cấp bậc");
        if (formDept.level !== DepartmentLevel.HQ && !formDept.parentId) throw new Error("Cần chọn đơn vị cấp trên trực thuộc");
        if (editingDeptId) {
             if (editingDeptId !== formDept.id) {
                 if(!confirm(`Xác nhận đổi Mã từ "${editingDeptId}" sang "${formDept.id}"?\n\nHệ thống sẽ TỰ ĐỘNG CHUYỂN toàn bộ nhân sự và phòng ban con sang mã mới.`)) return;
                 await storageService.migrateDepartmentId(editingDeptId, formDept as Department);
             } else await storageService.updateDepartment(formDept as Department);
        } else await storageService.addDepartment(formDept as Department);
        await refreshData(); setDeptModalOpen(false);
      } catch (e: any) { alert("Lỗi: " + e.message); }
  };
  const handleRequestDeleteHQ = async (deptId: string) => {
      const password = window.prompt("Nhập mật khẩu Admin để xác nhận xóa Trụ sở:");
      if (!password) return;
      if (password !== currentUser.password) return alert("Mật khẩu không đúng!");
      setUndoState({ id: deptId }); setUndoCountDown(10);
  };
  const handleUndoDelete = () => { setUndoState(null); setUndoCountDown(0); alert("Đã hoàn tác xóa Trụ sở!"); };
  const handleDeleteDept = async (id: string) => { if(confirm("Xóa phòng này?")) { try { await storageService.deleteDepartment(id); await refreshData(); } catch(e: any) { alert(e.message); } } };

  // --- NEW RENDER TREE NODES (Connected Lines via CSS) ---
  const renderTreeNodes = (parentId: string | null = null) => {
    let children: Department[] = [];
    if (parentId === null) children = departments.filter(d => d.level === DepartmentLevel.HQ);
    else children = departments.filter(d => d.parentId === parentId);
    if (children.length === 0) return null;

    return (
        <ul className="flex pt-5 relative transition-all duration-500 justify-center">
            {children.map((dept) => {
                const cumulativeCount = getCumulativeHeadcount(dept.id);
                let levelColor = 'bg-white border-gray-200 text-gray-800';
                let headerColor = 'bg-gray-100 text-gray-600';
                if (dept.level === DepartmentLevel.HQ) { levelColor = 'bg-blue-900 border-blue-900 text-white'; headerColor = 'bg-blue-800 text-blue-100'; }
                else if (dept.level === DepartmentLevel.REGION) { levelColor = 'bg-teal-700 border-teal-700 text-white'; headerColor = 'bg-teal-800 text-teal-100'; }
                else if (dept.level === DepartmentLevel.GROUP) { levelColor = 'bg-white border-teal-600 text-teal-900'; headerColor = 'bg-teal-600 text-white'; }
                else if (dept.level === DepartmentLevel.DEPARTMENT) { levelColor = 'bg-white border-blue-500 text-gray-800'; headerColor = 'bg-blue-500 text-white'; }
                else if (dept.level === DepartmentLevel.TEAM) { levelColor = 'bg-white border-gray-300 text-gray-800'; headerColor = 'bg-gray-100 text-gray-600'; }

                return (
                    <li key={dept.id} className="relative float-left text-center list-none p-5 px-2">
                        {/* Connector Styles */}
                        <style>{`
                            ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 1px solid #ccc; width: 0; height: 20px; }
                            li::before, li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 1px solid #ccc; width: 50%; height: 20px; }
                            li::after { right: auto; left: 50%; border-left: 1px solid #ccc; }
                            li:only-child::after, li:only-child::before { display: none; }
                            li:only-child { padding-top: 0; }
                            li:first-child::before, li:last-child::after { border: 0 none; }
                            li:last-child::before { border-right: 1px solid #ccc; border-radius: 0 5px 0 0; }
                            li:first-child::after { border-radius: 5px 0 0 0; }
                        `}</style>

                        <div className={`relative inline-block rounded-lg shadow-md border overflow-hidden min-w-[140px] max-w-[200px] z-10 transition-transform hover:scale-105 ${levelColor}`}>
                             <div className={`px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wider ${headerColor}`}>{dept.level}</div>
                             <div className="p-2 text-center">
                                 <h4 className="font-bold text-xs uppercase mb-1 leading-tight">{dept.name}</h4>
                                 {dept.managerName && <div className="text-[9px] opacity-80 mb-1">{dept.managerName}</div>}
                                 <div className="inline-flex items-center gap-1 bg-black/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                     <Users size={10}/> {cumulativeCount}
                                 </div>
                             </div>
                             {canEditStructure && (
                                <div className="flex border-t border-black/5 divide-x divide-black/5">
                                    <button onClick={() => { setEditingDeptId(dept.id); setFormDept(dept); setDeptModalOpen(true); }} className="flex-1 py-1 hover:bg-black/5 flex justify-center"><Edit size={12}/></button>
                                    {dept.level !== DepartmentLevel.HQ ? (
                                        <button onClick={() => handleDeleteDept(dept.id)} className="flex-1 py-1 hover:bg-red-50 hover:text-red-500 flex justify-center"><Trash2 size={12}/></button>
                                    ) : (
                                        <button onClick={() => handleRequestDeleteHQ(dept.id)} className="flex-1 py-1 hover:bg-red-50 hover:text-red-500 flex justify-center bg-red-50/50" title="Xóa Trụ sở (Admin only)"><ShieldAlert size={12}/></button>
                                    )}
                                </div>
                             )}
                        </div>
                        {renderTreeNodes(dept.id)}
                    </li>
                );
            })}
        </ul>
    );
  };

  if (viewingUser) {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-6 bg-white p-6 rounded-2xl shadow-lg">
                <Button onClick={() => setViewingUser(null)} variant="secondary" className="rounded-xl border border-gray-200">
                    <ArrowLeft size={18} className="mr-2"/> QUAY LẠI DANH SÁCH
                </Button>
                <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase">Hồ sơ: {viewingUser.name}</h2>
                    <div className="flex gap-3 mt-1">
                        <Badge variant="indigo">{ROLE_LABELS[viewingUser.role]}</Badge>
                        <span className="text-sm font-bold text-green-600 tracking-tight">DOANH THU: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculateTotalRevenue(viewingUser))}</span>
                    </div>
                </div>
            </div>
            <EmployeeDashboard user={viewingUser} isViewOnly={false} />
        </div>
    );
  }

  const allowedRoles = Object.values(UserRole).filter(r => ROLE_RANK[r] <= myRank);
  
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 relative">
      {undoState && (
          <div className="fixed bottom-6 right-6 z-50 animate-bounce">
              <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4">
                  <AlertTriangle className="animate-pulse" />
                  <div>
                      <h4 className="font-bold uppercase text-sm">Đang xóa Trụ sở!</h4>
                      <p className="text-xs opacity-90">Hành động sẽ thực hiện trong {undoCountDown}s</p>
                  </div>
                  <button onClick={handleUndoDelete} className="bg-white text-red-600 px-4 py-2 rounded-lg font-black text-xs hover:bg-red-50 transition-colors flex items-center gap-2"><RotateCcw size={14}/> HOÀN TÁC</button>
              </div>
          </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight leading-none">BẢNG ĐIỀU KHIỂN </h1>
            <p className="text-sm text-gray-400 font-bold uppercase mt-1">Phạm vi: {ROLE_LABELS[manager.role]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMsgModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 shadow-lg rounded-xl"><Send size={18} className="mr-2"/> THÔNG BÁO NHÓM</Button>
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
                <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Tổng quan</button>
                <button onClick={() => setActiveTab('personal')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'personal' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Cá nhân</button>
                <button onClick={() => setActiveTab('staff')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'staff' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Nhân sự</button>
                <button onClick={() => setActiveTab('chat')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'chat' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Hộp thư</button>
                <button onClick={() => setActiveTab('depts')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'depts' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Phòng ban</button>
                <button onClick={() => setActiveTab('logs')} className={`px-5 py-2 text-xs font-black uppercase rounded-lg transition-all ${activeTab === 'logs' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Hoạt động</button>
            </div>
        </div>
      </div>

      {activeTab === 'personal' && (
          <div className="animate-fadeIn">
              <div className="mb-4 flex items-center gap-2 bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800"><Briefcase size={20} /><span className="font-bold uppercase text-sm">Không gian làm việc cá nhân của Quản lý</span></div>
              <EmployeeDashboard user={currentUser} isViewOnly={false} />
          </div>
      )}

      {/* DASHBOARD TAB - KEEP EXISTING CONTENT */}
      {activeTab === 'dashboard' && (
          <div className="space-y-6">
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4"><UserCircle size={20} className="text-blue-600"/><h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Chỉ số cá nhân (Self-Sales) - Trong khoảng thời gian chọn</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                         <div>
                             <div className="text-xs font-bold text-gray-500 uppercase">Doanh thu tự bán</div>
                             <div className="text-2xl font-black text-blue-600 mt-1">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(dashboardStats.personal.revenue)}</div>
                             <div className="text-[10px] text-gray-400 mt-1">Trong khoảng thời gian đã chọn</div>
                         </div>
                         <div className="bg-white p-2 rounded-lg text-blue-500"><TrendingUp size={24}/></div>
                    </div>
                    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                         <div>
                             <div className="text-xs font-bold text-gray-500 uppercase">Cuộc hẹn cá nhân</div>
                             <div className="text-2xl font-black text-purple-600 mt-1">{dashboardStats.personal.apps}</div>
                             <div className="text-[10px] text-gray-400 mt-1">Trong khoảng thời gian đã chọn</div>
                         </div>
                         <div className="bg-white p-2 rounded-lg text-purple-500"><Calendar size={24}/></div>
                    </div>
                    <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 flex items-center justify-between">
                         <div>
                             <div className="text-xs font-bold text-gray-500 uppercase">Cuộc tư vấn</div>
                             <div className="text-2xl font-black text-teal-600 mt-1">{dashboardStats.personal.cons}</div>
                             <div className="text-[10px] text-gray-400 mt-1">Trong khoảng thời gian đã chọn</div>
                         </div>
                         <div className="bg-white p-2 rounded-lg text-teal-500"><MessageSquare size={24}/></div>
                    </div>
                </div>
             </div>
             
             <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-2"><UsersIcon size={20} className="text-indigo-600"/><h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Hiệu suất Đội nhóm & Cấp dưới</h3></div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                        <span className="pl-3 text-xs font-bold text-gray-500">Từ:</span>
                        <input type="date" className="text-xs font-bold text-gray-700 bg-transparent border-none focus:ring-0 p-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span className="text-gray-300">|</span>
                        <span className="text-xs font-bold text-gray-500">Đến:</span>
                        <input type="date" className="text-xs font-bold text-gray-700 bg-transparent border-none focus:ring-0 p-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-widest"><Filter size={14} /> Bộ lọc dữ liệu phân cấp</div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Select label="Khu vực" options={[{value: '', label: '-- Tất cả --'}, ...regionOptions.map(d => ({value: d.id, label: d.name}))]} value={filterRegion} onChange={e => setFilterRegion(e.target.value)} />
                        <Select label="Group" options={[{value: '', label: '-- Tất cả --'}, ...groupOptions.map(d => ({value: d.id, label: d.name}))]} value={filterGroup} onChange={e => setFilterGroup(e.target.value)} />
                        <Select label="Phòng" options={[{value: '', label: '-- Tất cả --'}, ...deptOptions.map(d => ({value: d.id, label: d.name}))]} value={filterDept} onChange={e => setFilterDept(e.target.value)} />
                        <Select label="Nhóm" options={[{value: '', label: '-- Tất cả --'}, ...teamOptions.map(d => ({value: d.id, label: d.name}))]} value={filterTeam} onChange={e => setFilterTeam(e.target.value)} />
                        <Select label="Nhân viên" options={[{value: '', label: '-- Tất cả --'}, ...structuredUsers.filter(u => u._isManager === false).map(u => ({value: u.id, label: u.name}))]} value={filterUser} onChange={e => setFilterUser(e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="border-t-4 border-t-indigo-500">
                        <div className="flex items-center justify-between">
                            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nhân sự cấp dưới (Lọc)</p><h3 className="text-4xl font-black text-gray-800">{dashboardStats.team.count}</h3></div>
                            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Users size={28}/></div>
                        </div>
                    </Card>
                    <Card className="border-t-4 border-t-green-500">
                        <div className="flex items-center justify-between">
                            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Doanh thu (Theo thời gian)</p><h3 className="text-2xl font-black text-green-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(dashboardStats.team.revenue)}</h3></div>
                            <div className="bg-green-50 p-3 rounded-2xl text-green-600"><TrendingUp size={28}/></div>
                        </div>
                    </Card>
                    <Card className="border-t-4 border-t-orange-500">
                        <div className="flex items-center justify-between">
                            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuộc hẹn (Theo thời gian)</p><h3 className="text-4xl font-black text-gray-800">{dashboardStats.team.apps}</h3></div>
                            <div className="bg-orange-50 p-3 rounded-2xl text-orange-600"><Calendar size={28}/></div>
                        </div>
                    </Card>
                    <Card className="border-t-4 border-t-teal-500">
                        <div className="flex items-center justify-between">
                            <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuộc tư vấn (Theo thời gian)</p><h3 className="text-4xl font-black text-gray-800">{dashboardStats.team.cons}</h3></div>
                            <div className="bg-teal-50 p-3 rounded-2xl text-teal-600"><MessageSquare size={28}/></div>
                        </div>
                    </Card>
                </div>

                <Card title="Phân tích tăng trưởng (Theo thời gian)">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 min-w-0">
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboardStats.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000000}M`} tick={{fontSize: 10}} />
                                        <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(v: any) => [new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v), 'Doanh thu']} />
                                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                                            {dashboardStats.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === dashboardStats.chartData.length - 1 ? '#3b82f6' : '#94a3b8'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="bg-blue-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                                    <div className="flex items-center gap-2"><LayoutGrid size={18} className="text-blue-400"/><span className="text-xs font-black uppercase tracking-widest">Báo cáo tự động</span></div>
                                    <p className="text-sm font-medium italic opacity-90 leading-relaxed text-blue-50">"{dashboardStats.conclusion}"</p>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-1">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-yellow-100 p-1.5 rounded-lg text-yellow-600"><Trophy size={16}/></div>
                                        <span className="text-xs font-black uppercase text-gray-700">Top 10 Xuất Sắc</span>
                                    </div>
                                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                                        <button onClick={() => setTop10Tab('REGION')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${top10Tab === 'REGION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Khu vực</button>
                                        <button onClick={() => setTop10Tab('COMPANY')} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${top10Tab === 'COMPANY' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Toàn ty</button>
                                    </div>
                                </div>
                                <div className="space-y-3 overflow-y-auto max-h-[200px] pr-2">
                                    {(top10Tab === 'REGION' ? dashboardStats.topEmployeesLocal : dashboardStats.topEmployeesGlobal).length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center italic py-4">Chưa có phát sinh doanh thu</p>
                                    ) : (
                                        (top10Tab === 'REGION' ? dashboardStats.topEmployeesLocal : dashboardStats.topEmployeesGlobal).map((c, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs group hover:bg-gray-50 p-1 rounded-md transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</span>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-700 truncate max-w-[120px]" title={c.name}>{c.name}</span>
                                                        <span className="text-[9px] text-gray-400 font-medium">{c.id}</span>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-blue-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(c.value)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
             </div>
          </div>
      )}

      {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 h-[700px] flex overflow-hidden">
              <div className="w-1/3 border-r border-gray-100 bg-gray-50 flex flex-col">
                  <div className="p-4 font-black text-gray-800 border-b uppercase text-sm tracking-tight flex items-center gap-2"><MessageSquare size={16} className="text-blue-500"/> Danh sách tin nhắn</div>
                  <div className="p-4 border-b bg-white space-y-3">
                      <div className="relative">
                          <input className="w-full border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Tìm tên hoặc mã nhân viên..." value={chatSearchTerm} onChange={e => setChatSearchTerm(e.target.value)} />
                          <Search size={16} className="absolute left-3.5 top-2.5 text-gray-400" />
                      </div>
                      <select className="w-full border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-600 bg-gray-50" value={chatFilterRole} onChange={e => setChatFilterRole(e.target.value)}>
                          <option value="">-- Tất cả chức vụ --</option>
                          {Object.values(UserRole).map(r => (<option key={r} value={r}>{ROLE_LABELS[r]}</option>))}
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      {chatUsers.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-xs italic">
                              {chatSearchTerm ? 'Không tìm thấy nhân viên phù hợp.' : 'Chưa có tin nhắn gần đây.'}
                          </div>
                      ) : (
                          chatUsers.map(u => (
                              <div key={u.id} onClick={() => setSelectedChatUser(u.id)} className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-white transition-all flex items-center gap-3 ${selectedChatUser === u.id ? 'bg-white border-l-4 border-l-blue-600' : ''}`}>
                                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{u.name.substring(0, 1)}</div>
                                  <div className="flex-1 overflow-hidden">
                                      <div className="font-black text-sm text-gray-800 truncate uppercase">{u.name}</div>
                                      <div className="text-[10px] text-gray-400 font-bold uppercase">{ROLE_LABELS[u.role]}</div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
              <div className="w-2/3 flex flex-col bg-[#f8fafc]">
                  {selectedChatUser ? (
                      <>
                        <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm z-10">
                            <span className="font-black text-gray-800 uppercase tracking-tight">Hội thoại: {allUsers.find(u => u.id === selectedChatUser)?.name}</span>
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {currentConversation.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderId === manager.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.senderId === manager.id ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                        <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                        <div className={`text-[9px] mt-2 font-black uppercase tracking-widest ${msg.senderId === manager.id ? 'text-blue-200 text-right' : 'text-gray-400'}`}>{new Date(msg.timestamp).toLocaleString('vi-VN')}</div>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef}></div>
                        </div>
                        <div className="p-4 bg-white border-t border-gray-100">
                             <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                  <input className="flex-1 bg-transparent border-none px-4 py-2 outline-none text-sm font-medium" placeholder="Nhập tin nhắn trả lời..." value={adminChatInput} onChange={e => setAdminChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminReply()} />
                                  <button onClick={handleAdminReply} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg"><Send size={18}/></button>
                             </div>
                        </div>
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                          <MessageSquare size={64} className="mb-4 opacity-10"/>
                          <p className="font-black text-xs uppercase tracking-widest">Chọn nhân sự để bắt đầu trao đổi</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* ACTIVITY LOGS TAB */}
      {activeTab === 'logs' && (
          <Card title="Nhật ký hoạt động cá nhân (200 bản ghi gần nhất)">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold">
                          <tr>
                              <th className="px-6 py-3">Thời gian</th>
                              <th className="px-6 py-3">Người thực hiện</th>
                              <th className="px-6 py-3">Thao tác</th>
                              <th className="px-6 py-3">Đối tượng</th>
                              <th className="px-6 py-3">Chi tiết</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {activities.length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Chưa có dữ liệu hoạt động</td></tr>
                          ) : (
                              activities.map(log => (
                                  <tr key={log.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-500">
                                          {new Date(log.timestamp).toLocaleString('vi-VN')}
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="font-bold text-gray-900">{log.actorName}</div>
                                          <div className="text-[10px] text-gray-400">{log.actorId}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                              log.action === 'TẠO' ? 'bg-green-100 text-green-700' :
                                              log.action === 'CẬP NHẬT' ? 'bg-blue-100 text-blue-700' :
                                              'bg-red-100 text-red-700'
                                          }`}>
                                              {log.action}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">
                                          {log.targetType}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-600">
                                          {log.description}
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <Card title="Quản lý đội ngũ nhân sự">
          <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
             <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="w-full md:w-64"><Input placeholder="Tìm nhanh nhân viên..." value={chatSearchTerm} onChange={e => setChatSearchTerm(e.target.value)} /></div>
                <div className="w-full md:w-64"><Select value={filterRole} onChange={e => setFilterRole(e.target.value)} options={[{value: '', label: '-- Lọc theo chức vụ --'}, ...Object.values(UserRole).map(r => ({value: r, label: ROLE_LABELS[r]}))]} /></div>
                <Button onClick={openAddUser} className="rounded-xl w-full md:w-auto px-6 font-black uppercase tracking-tight shadow-md">+ Tạo tài khoản mới</Button>
             </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-500 font-black uppercase tracking-widest">
                  <th className="px-6 py-4 text-left w-[40%]">Họ tên & Cấu trúc</th>
                  <th className="px-6 py-4 text-left">Mã NV</th>
                  <th className="px-6 py-4 text-left">Đơn vị quản lý</th>
                  <th className="px-6 py-4 text-right">Doanh thu (Lifetime)</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {structuredUsers
                    .filter(u => chatSearchTerm ? u.name.toLowerCase().includes(chatSearchTerm.toLowerCase()) || u.id.toLowerCase().includes(chatSearchTerm.toLowerCase()) : true)
                    .filter(u => filterRole ? u.role === filterRole : true)
                    .map(user => {
                        let rowBg = "bg-white";
                        if (user._depth === 0) rowBg = "bg-blue-50/30"; else if (user._depth === 1) rowBg = "bg-gray-50/50";
                        return (
                        <tr key={user.id} className={`${rowBg} hover:bg-blue-50 transition-colors`}>
                            <td className="px-6 py-4">
                                <div className="flex items-center relative" style={{ paddingLeft: `${user._depth * 28}px` }}>
                                    {user._depth > 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 border-l border-b border-gray-300 w-4 h-full" style={{ left: `${(user._depth - 1) * 28 + 12}px`, height: '120%', top: '-50%' }}></div>}
                                    {user._depth > 0 && <div className="absolute border-b border-gray-300 w-4 h-0" style={{ left: `${(user._depth - 1) * 28 + 12}px` }}></div>}
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${user._depth === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{user.name.charAt(0)}</div>
                                        <div><div className={`font-bold uppercase leading-tight ${user._depth === 0 ? 'text-blue-800 text-sm' : 'text-gray-800'}`}>{user.name}</div><div className="flex items-center gap-2 mt-1"><Badge variant="neutral" className="text-[9px]">{ROLE_LABELS[user.role]}</Badge>{user.phone && <span className="text-[10px] text-gray-400">{user.phone}</span>}</div></div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 font-black text-gray-900 uppercase tracking-tight">{user.id}</td>
                            <td className="px-6 py-4"><div className="flex flex-col"><span className="text-[10px] font-bold text-indigo-600 uppercase">{user._deptName}</span>{user._isManager && <span className={`text-[9px] font-bold w-fit px-1 rounded uppercase mt-0.5 ${user.role === UserRole.GROUP_MANAGER ? 'text-teal-700 bg-teal-50' : user.role === UserRole.TEAM_LEADER ? 'text-blue-700 bg-blue-50' : 'text-orange-500 bg-orange-50'}`}>QUẢN LÝ</span>}</div></td>
                            <td className="px-6 py-4 text-right font-black text-green-600 text-sm">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculateTotalRevenue(user))}</td>
                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setViewingUser(user)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Xem báo cáo"><Eye size={18}/></button><button onClick={() => openEditUser(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button><button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button></div></td>
                        </tr>
                        )
                    })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'depts' && (
          <div className="bg-gray-200/50 p-6 rounded-2xl overflow-x-auto min-h-[600px] border border-gray-200">
             <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                 <div className="text-xs text-gray-500 italic flex items-center gap-2"><CornerDownRight size={14}/>Sơ đồ tổ chức hiển thị theo cấp bậc phân nhánh</div>
                 {canEditStructure && <Button onClick={openAddDept} className="rounded-xl shadow-lg font-black uppercase px-6">+ Thành lập đơn vị thủ công</Button>}
             </div>
             <div className="flex justify-center min-w-max pb-12 tree">
                {renderTreeNodes(null)}
             </div>
             {/* Orphan/Error Depts Cleanup Section */}
             {canEditStructure && orphanDepts.length > 0 && (
                <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl">
                    <h3 className="text-sm font-bold text-red-600 uppercase mb-3 flex items-center gap-2"><AlertOctagon size={16}/> Đơn vị lỗi / Chưa phân cấp ({orphanDepts.length})</h3>
                    <p className="text-xs text-gray-500 mb-4">Các đơn vị này không có cấp bậc hoặc không có đơn vị cấp trên. Bạn có thể xóa chúng nếu không cần thiết.</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {orphanDepts.map(d => (
                            <div key={d.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-center group hover:bg-red-50 transition-colors">
                                <div>
                                    <div className="text-xs font-bold text-gray-700">{d.name || '(Không tên)'}</div>
                                    <div className="text-[10px] text-gray-400 font-medium">{d.id}</div>
                                    <div className="text-[9px] text-red-400 italic">{d.level || 'Undefined level'}</div>
                                </div>
                                <button onClick={() => handleDeleteDept(d.id)} className="text-red-300 hover:text-red-600 p-1.5 rounded bg-red-50"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
             )}
          </div>
      )}

      {/* Modals Retained As Is ... */}
      <Modal isOpen={isMsgModalOpen} onClose={() => setMsgModalOpen(false)} title="GỬI THÔNG BÁO TỚI ĐỘI NGŨ">
          <div className="space-y-4 p-1">
              <Select label="Đối tượng nhận tin" options={[{value: 'ALL', label: 'Tất cả nhân viên cấp dưới'}, {value: 'DEPT', label: 'Theo phòng ban (Kèm cấp dưới)'}, {value: 'USER', label: 'Cá nhân cụ thể'}]} value={msgTargetType} onChange={(e: any) => setMsgTargetType(e.target.value)} />
              {msgTargetType === 'DEPT' && (<Combobox label="Chọn phòng ban (Có hỗ trợ tìm kiếm)" placeholder="Nhập tên phòng hoặc mã..." options={departments.map(d => `${d.name} [${d.id}]`)} value={msgTargetId ? `${departments.find(d => d.id === msgTargetId)?.name} [${msgTargetId}]` : ''} onChange={(val) => { const matches = val.match(/\[(.*?)\]$/); if (matches && matches[1]) setMsgTargetId(matches[1]); else setMsgTargetId(''); }} />)}
              {msgTargetType === 'USER' && (<Select label="Chọn nhân viên" options={mySubordinates.filter(u => u.id !== manager.id).map(u => ({value: u.id, label: u.name}))} value={msgTargetId} onChange={e => setMsgTargetId(e.target.value)} />)}
              <div className="w-full"><label className="block text-sm font-black uppercase tracking-widest text-gray-500 mb-1">Nội dung thông báo</label><textarea className="w-full border border-gray-200 rounded-xl p-4 h-40 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm" value={msgContent} onChange={e => setMsgContent(e.target.value)} placeholder="Nhập chỉ thị hoặc thông báo tại đây..."></textarea></div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-6"><Button variant="ghost" onClick={() => setMsgModalOpen(false)}>HỦY BỎ</Button><Button onClick={handleSendMessage} className="px-8 shadow-lg shadow-blue-100 uppercase font-black">XÁC NHẬN GỬI</Button></div>
          </div>
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title={editingUserId ? "CẬP NHẬT TÀI KHOẢN" : "CẤP TÀI KHOẢN MỚI"}>
        <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4"><Input label="Mã nhân viên" value={formUser.id || ''} onChange={e => setFormUser({...formUser, id: e.target.value.toUpperCase()})} disabled={!!editingUserId} placeholder="NV..." /><Input label="Họ và tên" value={formUser.name || ''} onChange={e => setFormUser({...formUser, name: e.target.value})} placeholder="Nguyễn Văn A" /></div>
            <div className="grid grid-cols-2 gap-4"><Input label="Mật khẩu" value={formUser.password || ''} onChange={e => setFormUser({...formUser, password: e.target.value})} /><Input label="Số điện thoại" value={formUser.phone || ''} onChange={e => setFormUser({...formUser, phone: e.target.value})} /></div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                <Select label="Vai trò hệ thống" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value as UserRole})} options={allowedRoles.map(role => ({value: role, label: ROLE_LABELS[role]}))} />
                
                {formUser.role === UserRole.EMPLOYEE ? (
                    <Select 
                        label="Trực thuộc đơn vị (Phòng/Nhóm)" 
                        value={formUser.departmentId || ''} 
                        onChange={e => setFormUser({...formUser, departmentId: e.target.value})} 
                        options={[
                            {value: '', label: '-- Chọn đơn vị --'}, 
                            ...departments
                                .filter(d => d.level && d.name) // Filter out invalid/ghost departments
                                .map(d => ({value: d.id, label: `${d.name} (${d.level})`}))
                        ]} 
                    />
                ) : (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center gap-2 mb-2"><GitMerge size={16} className="text-blue-500"/><span className="text-xs font-black uppercase text-gray-500">Cấu hình Đơn vị quản lý mới</span></div>
                        
                        {!editingUserId && (
                            <>
                                <Input 
                                    label={`Tên đơn vị quản lý (Để trống sẽ tự động lấy tên: "Cấp bậc + Tên")`} 
                                    placeholder={`Ví dụ: Nhóm ${formUser.name || '...'}`} 
                                    value={formUser.newDeptName || ''} 
                                    onChange={e => setFormUser({...formUser, newDeptName: e.target.value})}
                                />
                                {formUser.role !== UserRole.REGIONAL_MANAGER && (
                                    <Combobox 
                                        label={`Trực thuộc đơn vị cấp trên (Bắt buộc)`} 
                                        placeholder="Nhập tên hoặc mã đơn vị..."
                                        value={formUser.newDeptParentId ? `${departments.find(d => d.id === formUser.newDeptParentId)?.name} [${formUser.newDeptParentId}]` : ''} 
                                        onChange={(val) => {
                                            const matches = val.match(/\[(.*?)\]$/);
                                            if (matches && matches[1]) {
                                                setFormUser({...formUser, newDeptParentId: matches[1]});
                                            } else {
                                                // If user clears input or types invalid format, consider clearing ID or handle gracefully
                                                setFormUser({...formUser, newDeptParentId: ''});
                                            }
                                        }}
                                        options={departments.filter(d => d.level !== DepartmentLevel.TEAM).map(d => `${d.name} [${d.id}]`)} 
                                    />
                                )}
                            </>
                        )}

                        {editingUserId && (<div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700"><b>Lưu ý:</b> Đang chỉnh sửa tài khoản quản lý. Nếu muốn thay đổi đơn vị quản lý, vui lòng sử dụng tab "Phòng ban".</div>)}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4"><Input label="Ngày gia nhập" type="date" value={formUser.joinDate || ''} onChange={e => setFormUser({...formUser, joinDate: e.target.value})} /><Input label="Doanh thu ban đầu" type="number" value={formUser.initialRevenue || 0} onChange={e => setFormUser({...formUser, initialRevenue: Number(e.target.value)})} /></div>
            <div className="flex justify-end gap-3 pt-6 border-t mt-4"><Button variant="ghost" onClick={() => setUserModalOpen(false)}>HỦY</Button><Button onClick={handleSubmitUser} className="px-8 font-black uppercase">LƯU THÔNG TIN</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isDeptModalOpen} onClose={() => setDeptModalOpen(false)} title={editingDeptId ? "SỬA ĐƠN VỊ" : "THÀNH LẬP ĐƠN VỊ MỚI"}>
          <div className="space-y-4 p-1">
              <Input label="Mã Đơn vị" value={formDept.id || ''} onChange={e => setFormDept({...formDept, id: e.target.value.toUpperCase()})} placeholder="VD: KV01, GRP02..." />
              {editingDeptId && editingDeptId !== formDept.id && (<div className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded">Lưu ý: Bạn đang thay đổi Mã đơn vị. Hành động này sẽ xóa đơn vị cũ và tạo đơn vị mới.</div>)}
              <Input label="Tên Đơn vị" value={formDept.name || ''} onChange={e => setFormDept({...formDept, name: e.target.value})} placeholder="Tên hiển thị..." />
              <Select label="Cấp bậc" value={formDept.level} onChange={e => { const newLevel = e.target.value as DepartmentLevel; setFormDept({...formDept, level: newLevel, parentId: ''}); }} options={Object.values(DepartmentLevel).map(v => ({value: v, label: v}))} />
              {formDept.level && formDept.level !== DepartmentLevel.HQ && (<Select label={`Trực thuộc đơn vị (${getAvailableParents(formDept.level).length > 0 ? 'Chọn bên dưới' : 'Chưa có cấp trên phù hợp'})`} value={formDept.parentId || ''} onChange={e => setFormDept({...formDept, parentId: e.target.value})} options={[{value: '', label: '-- Chọn đơn vị cấp trên --'}, ...getAvailableParents(formDept.level).map(d => ({value: d.id, label: d.name}))]} />)}
              <div className="grid grid-cols-2 gap-4"><div className="relative"><Input label="Mã Quản lý (Mã NV)" value={formDept.managerId || ''} onChange={e => setFormDept({...formDept, managerId: e.target.value.toUpperCase()})} onBlur={() => { const user = allUsers.find(u => u.id === formDept.managerId); if (user) { setFormDept(prev => ({...prev, managerName: user.name})); } else if (formDept.managerId) { alert("Không tìm thấy nhân viên với mã này!"); setFormDept(prev => ({...prev, managerName: ''})); } }} placeholder="Nhập mã NV..." />{formDept.managerName && <span className="absolute right-2 top-9 text-green-600"><CheckCircle size={16}/></span>}</div><Input label="Tên Quản lý (Tự động)" value={formDept.managerName || ''} disabled className="bg-gray-100 text-gray-500 font-bold" /></div>
              <div className="flex justify-end gap-3 pt-6 border-t mt-4"><Button variant="ghost" onClick={() => setDeptModalOpen(false)}>HỦY</Button><Button onClick={handleSubmitDept} className="px-8 font-black uppercase">LƯU CẤU TRÚC</Button></div>
          </div>
      </Modal>
    </div>
  );
};
