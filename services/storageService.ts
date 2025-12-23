

import { db } from './firebaseConfig';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { User, Department, Appointment, Consultation, Revenue, RevenueType, ProjectProfile, Message, UserRole, DepartmentLevel, ActivityLog, MonthlyTarget } from '../types';

// Collection Names in Firestore
const COLS = {
  USERS: 'users',
  DEPTS: 'departments',
  APPS: 'appointments',
  CONSULTS: 'consultations',
  REVENUES: 'revenues',
  PROJECTS: 'projects',
  MESSAGES: 'messages',
  ACTIVITIES: 'activities',
  TARGETS: 'targets' // New Collection for monthly goals
};

// Helper to map Firestore docs to our types
const mapDoc = (doc: any) => ({ ...doc.data(), id: doc.id });

// Helper for Logging
const logActivity = async (
    actor: { id: string, name: string } | undefined, 
    action: 'TẠO' | 'CẬP NHẬT' | 'XÓA', 
    targetType: 'HẸN' | 'TƯ VẤN' | 'DOANH THU' | 'DỰ ÁN' | 'HỆ THỐNG', 
    targetId: string, 
    description: string
) => {
    if (!actor) return; // Don't log if actor is unknown (system actions usually)
    try {
        const logId = `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const log: ActivityLog = {
            id: logId,
            actorId: actor.id,
            actorName: actor.name,
            action,
            targetType,
            targetId,
            description,
            timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, COLS.ACTIVITIES, logId), log);
    } catch (e) {
        console.error("Logging failed", e);
    }
};

export const storageService = {
  // --- Auth & System Init ---
  
  // Check and seed default admin if system is empty
  initializeSystem: async () => {
    try {
        // Check specifically for ADMIN to ensure credentials
        const adminRef = doc(db, COLS.USERS, 'ADMIN');
        const adminSnap = await getDoc(adminRef);

        const adminData: User = {
            id: 'ADMIN',
            name: 'Administrator',
            role: UserRole.DIRECTOR,
            password: 'caofi17', // Updated Password
            joinDate: new Date().toISOString(),
            initialRevenue: 0
        };

        if (!adminSnap.exists()) {
            console.log("Seeding default Admin...");
            await setDoc(adminRef, adminData);

            const hqRef = doc(db, COLS.DEPTS, 'HQ');
            const hqSnap = await getDoc(hqRef);
            if (!hqSnap.exists()) {
                await setDoc(hqRef, {
                    id: 'HQ',
                    name: 'Trụ sở chính',
                    managerName: 'Administrator',
                    managerId: 'ADMIN',
                    level: DepartmentLevel.HQ,
                    parentId: null
                });
            }
        } else {
            // Force update password if it doesn't match the new one
            const currentData = adminSnap.data();
            if (currentData.password !== 'caofi17') {
                console.log("Updating Admin password to new policy...");
                await updateDoc(adminRef, { password: 'caofi17' });
            }
            
            // Ensure HQ has level info (migration for existing data)
            const hqRef = doc(db, COLS.DEPTS, 'HQ');
            const hqSnap = await getDoc(hqRef);
            if (hqSnap.exists()) {
                const hqData = hqSnap.data();
                if (!hqData.level) {
                     await updateDoc(hqRef, { level: DepartmentLevel.HQ, parentId: null, managerId: 'ADMIN' });
                }
            }
        }
    } catch (error) {
        console.error("Init Error:", error);
    }
  },

  login: async (code: string, password?: string): Promise<User | null> => {
    try {
        // Ensure system is initialized
        await storageService.initializeSystem();

        const docRef = doc(db, COLS.USERS, code);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const user = mapDoc(docSnap) as User;
            // Simple password check (In production, use Firebase Auth or Hash)
            if (user.password === password || (!user.password && !password)) {
                localStorage.setItem('sf_current_user_id', user.id); // Keep session locally
                return user;
            }
        }
        return null;
    } catch (e) {
        console.error("Login Error:", e);
        return null;
    }
  },

  logout: () => {
    localStorage.removeItem('sf_current_user_id');
  },

  getCurrentUser: async (): Promise<User | null> => {
      const id = localStorage.getItem('sf_current_user_id');
      if (!id) return null;
      const docSnap = await getDoc(doc(db, COLS.USERS, id));
      return docSnap.exists() ? (mapDoc(docSnap) as User) : null;
  },

  changePassword: async (userId: string, oldPass: string, newPass: string) => {
      const docRef = doc(db, COLS.USERS, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
          throw new Error("Người dùng không tồn tại.");
      }

      const userData = docSnap.data() as User;
      
      // Nếu user chưa có pass (cũ) thì cho đổi luôn, ngược lại phải check pass cũ
      if (userData.password && userData.password !== oldPass) {
          throw new Error("Mật khẩu hiện tại không chính xác.");
      }

      await updateDoc(docRef, { password: newPass });
  },

  // --- ACTIVITY LOGS ---
  getActivities: async (userId?: string): Promise<ActivityLog[]> => {
      // If userId is provided, filter by actorId. 
      // To avoid requiring a composite index, we fetch all logs for the user and sort in memory.
      if (userId) {
          const q = query(collection(db, COLS.ACTIVITIES), where("actorId", "==", userId));
          const snap = await getDocs(q);
          const logs = snap.docs.map(d => mapDoc(d) as ActivityLog);
          // Sort descending by timestamp string
          logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          return logs.slice(0, 200);
      } else {
          // Global logs - default behavior
          const q = query(collection(db, COLS.ACTIVITIES), orderBy("timestamp", "desc"), limit(200));
          const snap = await getDocs(q);
          return snap.docs.map(d => mapDoc(d) as ActivityLog);
      }
  },

  // --- MONTHLY TARGETS ---
  saveMonthlyTarget: async (target: MonthlyTarget) => {
      await setDoc(doc(db, COLS.TARGETS, target.id), target);
  },
  
  getMonthlyTarget: async (userId: string, monthStr: string): Promise<MonthlyTarget | null> => {
      const id = `${userId}_${monthStr.replace(/-/g, '_')}`;
      const docSnap = await getDoc(doc(db, COLS.TARGETS, id));
      return docSnap.exists() ? (mapDoc(docSnap) as MonthlyTarget) : null;
  },
  
  getAllTargetsByUser: async (userId: string): Promise<MonthlyTarget[]> => {
      const q = query(collection(db, COLS.TARGETS), where("userId", "==", userId));
      const snap = await getDocs(q);
      return snap.docs.map(d => mapDoc(d) as MonthlyTarget);
  },

  // --- CRUD Standard (Now Async) ---

  // DEPARTMENTS
  getDepartments: async (): Promise<Department[]> => {
      const snap = await getDocs(collection(db, COLS.DEPTS));
      return snap.docs.map(d => mapDoc(d) as Department);
  },
  addDepartment: async (item: Department) => {
      await setDoc(doc(db, COLS.DEPTS, item.id), item);
  },
  updateDepartment: async (item: Department) => {
      await updateDoc(doc(db, COLS.DEPTS, item.id), { ...item });
  },
  // NEW: Migrate Department ID and Cascade Update Children
  migrateDepartmentId: async (oldId: string, newDeptData: Department) => {
      const batch = writeBatch(db);

      // 1. Create New Department
      const newDeptRef = doc(db, COLS.DEPTS, newDeptData.id);
      batch.set(newDeptRef, newDeptData);

      // 2. Find and Update Child Departments (where parentId == oldId)
      const childDeptQuery = query(collection(db, COLS.DEPTS), where("parentId", "==", oldId));
      const childDeptSnap = await getDocs(childDeptQuery);
      childDeptSnap.forEach((doc) => {
          batch.update(doc.ref, { parentId: newDeptData.id });
      });

      // 3. Find and Update Users (where departmentId == oldId)
      const usersQuery = query(collection(db, COLS.USERS), where("departmentId", "==", oldId));
      const usersSnap = await getDocs(usersQuery);
      usersSnap.forEach((doc) => {
          batch.update(doc.ref, { departmentId: newDeptData.id });
      });

      // 4. Delete Old Department
      const oldDeptRef = doc(db, COLS.DEPTS, oldId);
      batch.delete(oldDeptRef);

      // Commit all changes
      await batch.commit();
  },
  deleteDepartment: async (id: string) => {
      await deleteDoc(doc(db, COLS.DEPTS, id));
  },

  // USERS
  getUsers: async (): Promise<User[]> => {
      const snap = await getDocs(collection(db, COLS.USERS));
      return snap.docs.map(d => mapDoc(d) as User);
  },
  
  getSubordinates: async (managerId: string): Promise<User[]> => {
      const allUsers = await storageService.getUsers();
      const result: User[] = [];
      
      const findDirectReports = (id: string) => {
          const directReports = allUsers.filter(u => u.managerId === id);
          for (const report of directReports) {
              result.push(report);
              findDirectReports(report.id);
          }
      };
      
      findDirectReports(managerId);
      return result;
  },

  addUser: async (item: User) => {
      const check = await getDoc(doc(db, COLS.USERS, item.id));
      if (check.exists()) throw new Error("Mã nhân viên đã tồn tại");
      await setDoc(doc(db, COLS.USERS, item.id), item);
  },
  updateUser: async (item: User) => {
      await updateDoc(doc(db, COLS.USERS, item.id), { ...item });
  },
  deleteUser: async (id: string) => {
      if (id === 'ADMIN') throw new Error("Không thể xóa Admin chính");
      await deleteDoc(doc(db, COLS.USERS, id));
  },

  // APPOINTMENTS
  getAppointments: async (): Promise<Appointment[]> => {
      const snap = await getDocs(collection(db, COLS.APPS));
      return snap.docs.map(d => mapDoc(d) as Appointment);
  },
  addAppointment: async (item: Appointment, actor?: {id: string, name: string}) => {
      await setDoc(doc(db, COLS.APPS, item.id), item);
      await logActivity(actor, 'TẠO', 'HẸN', item.id, `Khách hàng: ${item.customerName}, SĐT: ${item.phone}`);
  },
  updateAppointment: async (item: Appointment, actor?: {id: string, name: string}) => {
      await updateDoc(doc(db, COLS.APPS, item.id), { ...item });
      await logActivity(actor, 'CẬP NHẬT', 'HẸN', item.id, `Cập nhật thông tin cuộc hẹn với ${item.customerName}`);
  },
  deleteAppointment: async (id: string, actor?: {id: string, name: string}) => {
      await deleteDoc(doc(db, COLS.APPS, id));
      await logActivity(actor, 'XÓA', 'HẸN', id, `Xóa cuộc hẹn ID: ${id}`);
  },

  // CONSULTATIONS
  getConsultations: async (): Promise<Consultation[]> => {
      const snap = await getDocs(collection(db, COLS.CONSULTS));
      return snap.docs.map(d => mapDoc(d) as Consultation);
  },
  addConsultation: async (item: Consultation, actor?: {id: string, name: string}) => {
      await setDoc(doc(db, COLS.CONSULTS, item.id), item);
      await logActivity(actor, 'TẠO', 'TƯ VẤN', item.id, `Khách hàng: ${item.customerName}, Loại: ${item.type}`);
  },
  updateConsultation: async (item: Consultation, actor?: {id: string, name: string}) => {
      await updateDoc(doc(db, COLS.CONSULTS, item.id), { ...item });
      await logActivity(actor, 'CẬP NHẬT', 'TƯ VẤN', item.id, `Cập nhật phiếu tư vấn của ${item.customerName}`);
  },
  deleteConsultation: async (id: string, actor?: {id: string, name: string}) => {
      await deleteDoc(doc(db, COLS.CONSULTS, id));
      await logActivity(actor, 'XÓA', 'TƯ VẤN', id, `Xóa phiếu tư vấn ID: ${id}`);
  },

  // REVENUES
  getRevenues: async (): Promise<Revenue[]> => {
      const snap = await getDocs(collection(db, COLS.REVENUES));
      return snap.docs.map(d => mapDoc(d) as Revenue);
  },
  addRevenue: async (item: Revenue, actor?: {id: string, name: string}) => {
      await setDoc(doc(db, COLS.REVENUES, item.id), item);
      await logActivity(actor, 'TẠO', 'DOANH THU', item.id, `HĐ: ${item.contractCode}, Số tiền: ${item.amountCollected}`);
      // NOTE: Project creation is now handled in the UI to ensure full data (name, phone) is captured.
  },
  updateRevenue: async (item: Revenue, actor?: {id: string, name: string}) => {
      await updateDoc(doc(db, COLS.REVENUES, item.id), { ...item });
      await logActivity(actor, 'CẬP NHẬT', 'DOANH THU', item.id, `HĐ: ${item.contractCode}, Cập nhật số tiền/thông tin`);
  },
  deleteRevenue: async (id: string, actor?: {id: string, name: string}) => {
      await deleteDoc(doc(db, COLS.REVENUES, id));
      await logActivity(actor, 'XÓA', 'DOANH THU', id, `Xóa khoản thu ID: ${id}`);
  },

  // PROJECT PROFILES
  getProjects: async (): Promise<ProjectProfile[]> => {
      const snap = await getDocs(collection(db, COLS.PROJECTS));
      return snap.docs.map(d => mapDoc(d) as ProjectProfile);
  },
  addProject: async (item: ProjectProfile) => {
      const q = query(collection(db, COLS.PROJECTS), where("contractCode", "==", item.contractCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
          const safeId = `PROJ_${item.contractCode.replace(/\W/g, '')}_${Date.now()}`;
          await setDoc(doc(db, COLS.PROJECTS, safeId), item);
      }
  },
  updateProject: async (item: ProjectProfile, actor?: {id: string, name: string}, changeDetail?: string) => {
      const q = query(collection(db, COLS.PROJECTS), where("contractCode", "==", item.contractCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
          const docId = snap.docs[0].id;
          await updateDoc(doc(db, COLS.PROJECTS, docId), { ...item });
          if (actor) {
              await logActivity(actor, 'CẬP NHẬT', 'DỰ ÁN', docId, changeDetail || `Cập nhật hồ sơ dự án ${item.contractCode}`);
          }
      }
  },
  deleteProject: async (contractCode: string, actor?: {id: string, name: string}) => {
      const q = query(collection(db, COLS.PROJECTS), where("contractCode", "==", contractCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
          const docId = snap.docs[0].id;
          await deleteDoc(doc(db, COLS.PROJECTS, docId));
          if (actor) {
              await logActivity(actor, 'XÓA', 'DỰ ÁN', contractCode, `Xóa hồ sơ dự án ${contractCode}`);
          }
      }
  },

  // MESSAGES
  getMessages: async (): Promise<Message[]> => {
      const snap = await getDocs(collection(db, COLS.MESSAGES));
      return snap.docs.map(d => mapDoc(d) as Message);
  },
  sendMessage: async (msg: Message) => {
      await setDoc(doc(db, COLS.MESSAGES, msg.id), msg);
  },
  markMessageRead: async (msgId: string) => {
      await updateDoc(doc(db, COLS.MESSAGES, msgId), { isRead: true });
  },

  // --- Helpers ---
  findGlobalAppointmentByPhone: async (phone: string): Promise<{ appointment: Appointment, creatorName: string } | null> => {
    const q = query(collection(db, COLS.APPS), where("phone", "==", phone));
    const snap = await getDocs(q);
    const apps = snap.docs.map(d => mapDoc(d) as Appointment);
    const found = apps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    if (found) {
        const userDoc = await getDoc(doc(db, COLS.USERS, found.userId));
        const creator = userDoc.exists() ? (userDoc.data() as User) : null;
        return { appointment: found, creatorName: creator ? creator.name : found.userId };
    }
    return null;
  },
  
  findTeamDuplicate: async (phone: string, currentUserId: string): Promise<{ name: string, role: string } | null> => {
      const currentUserDoc = await getDoc(doc(db, COLS.USERS, currentUserId));
      if (!currentUserDoc.exists()) return null;
      const currentUser = currentUserDoc.data() as User;
      if (!currentUser.managerId) return null;

      const usersQ = query(collection(db, COLS.USERS), where("managerId", "==", currentUser.managerId));
      const usersSnap = await getDocs(usersQ);
      const teamMembers = usersSnap.docs.map(d => mapDoc(d) as User).filter(u => u.id !== currentUserId);
      const teamIds = teamMembers.map(u => u.id);

      if (teamIds.length === 0) return null;

      const appsSnap = await getDocs(query(collection(db, COLS.APPS), where("phone", "==", phone)));
      const apps = appsSnap.docs.map(d => mapDoc(d) as Appointment).filter(a => teamIds.includes(a.userId));
      
      if (apps.length > 0) {
          const owner = teamMembers.find(u => u.id === apps[0].userId);
          if (owner) return { name: owner.name, role: 'Hẹn' };
      }
      
      const consSnap = await getDocs(query(collection(db, COLS.CONSULTS), where("phone", "==", phone)));
      const cons = consSnap.docs.map(d => mapDoc(d) as Consultation).filter(c => teamIds.includes(c.userId));

      if (cons.length > 0) {
           const owner = teamMembers.find(u => u.id === cons[0].userId);
           if (owner) return { name: owner.name, role: 'Tư vấn' };
      }

      return null;
  },
  
  findCustomerByPhone: async (phone: string) => {
      const projSnap = await getDocs(query(collection(db, COLS.PROJECTS), where("phone", "==", phone)));
      if (!projSnap.empty) {
          const proj = mapDoc(projSnap.docs[0]) as ProjectProfile;
          return { 
              name: proj.customerName || '', 
              company: proj.companyName || '', 
              address: proj.address || '', 
              source: proj.source || '',
              contractCode: proj.contractCode, 
              city: proj.region || '' 
          };
      }
      const appSnap = await getDocs(query(collection(db, COLS.APPS), where("phone", "==", phone)));
      if (!appSnap.empty) {
          const app = mapDoc(appSnap.docs[0]) as Appointment;
          return { 
            name: app.customerName, 
            company: app.companyName, 
            address: app.addressDetail, 
            source: app.source,
            city: app.location 
          };
      }
      const conSnap = await getDocs(query(collection(db, COLS.CONSULTS), where("phone", "==", phone)));
      if (!conSnap.empty) {
          const cons = mapDoc(conSnap.docs[0]) as Consultation;
          return { 
            name: cons.customerName, 
            company: cons.companyName, 
            address: cons.addressDetail, 
            source: cons.source,
            city: '' 
          };
      }
      return null;
  },

  getContractCandidatesForHandover: async (userId: string): Promise<Revenue[]> => {
    const q = query(collection(db, COLS.REVENUES), where("userId", "==", userId), where("type", "==", RevenueType.NEW));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapDoc(d) as Revenue);
  }
};
