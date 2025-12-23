

export enum RevenueType {
  NEW = 'Ký mới',
  HOSTING = 'Hosting',
  HANDOVER = 'Bàn giao',
  UPGRADE_WEB = 'Nâng cấp Web',
  UPGRADE_HOSTING = 'Nâng cấp Hosting'
}

export enum ConsultationType {
  NEW = 'Tư vấn mới',
  OLD = 'Tư vấn cũ',
  DESIGN_REVIEW = 'Duyệt Design',
  HANDOVER = 'Bàn giao',
  UPGRADE = 'Nâng cấp',
  RESTORE = 'Khôi phục Web',
  SUPPORT = 'Hỗ trợ khách hàng',
}

export enum SupportType {
  SOLO = 'Solo',
  COMBINED = 'Kết hợp',
  SUPPORT = 'Hỗ trợ',
  REQUEST_SUPPORT = 'Nhờ hỗ trợ'
}

export enum AppointmentStatus {
  NEW = 'Mới',
  PENDING = 'Lưỡng lự',
  INTERESTED = 'Quan tâm',
  CLOSED = 'Chốt',
  CANCELLED = 'Hủy'
}

// Hierarchy Roles
export enum UserRole {
  DIRECTOR = 'director',             // Giám đốc kinh doanh (Admin cũ)
  REGIONAL_MANAGER = 'regional_manager', // Trưởng khu vực
  GROUP_MANAGER = 'group_manager',       // Trưởng group
  MANAGER = 'manager',                   // Quản lý
  TEAM_LEADER = 'team_leader',           // Trưởng nhóm
  EMPLOYEE = 'employee'                  // Nhân viên
}

export const ROLE_RANK = {
  [UserRole.DIRECTOR]: 6,
  [UserRole.REGIONAL_MANAGER]: 5,
  [UserRole.GROUP_MANAGER]: 4,
  [UserRole.MANAGER]: 3,
  [UserRole.TEAM_LEADER]: 2,
  [UserRole.EMPLOYEE]: 1,
};

export const ROLE_LABELS = {
  [UserRole.DIRECTOR]: 'Giám đốc Kinh Doanh',
  [UserRole.REGIONAL_MANAGER]: 'Trưởng Khu Vực',
  [UserRole.GROUP_MANAGER]: 'Trưởng Group',
  [UserRole.MANAGER]: 'Quản Lý',
  [UserRole.TEAM_LEADER]: 'Trưởng Nhóm',
  [UserRole.EMPLOYEE]: 'Nhân viên'
};

// --- Updated Department Structure ---
export enum DepartmentLevel {
  HQ = 'Trụ sở',
  REGION = 'Khu vực',
  GROUP = 'Group',
  DEPARTMENT = 'Phòng',
  TEAM = 'Nhóm'
}

export interface Department {
  id: string;
  name: string;
  managerName: string;
  managerId?: string; // Added field for linking
  level: DepartmentLevel; 
  parentId?: string | null; // ID of the parent unit (e.g., Group belongs to Region)
}

export interface User {
  id: string; // Employee Code
  name: string;
  role: UserRole; 
  managerId?: string; // ID của người quản lý trực tiếp (người tạo ra account này)
  departmentId?: string;
  password?: string;
  phone?: string; // Số điện thoại
  joinDate?: string; 
  initialRevenue?: number; 
}

export interface Appointment {
  id: string;
  userId: string;
  companyName: string;
  customerName: string;
  phone: string;
  email?: string; 
  source: string;
  status: AppointmentStatus;
  date: string; 
  location: string; 
  addressDetail?: string; 
  notes?: string;
}

export interface Consultation {
  id: string;
  userId: string;
  appointmentId?: string;
  customerName: string;
  phone: string;
  companyName?: string;
  source?: string;
  addressDetail?: string;
  
  type: ConsultationType;
  supportType: SupportType; 
  supportPersonName?: string;
  notes?: string;
  date: string;
}

export interface Revenue {
  id: string;
  userId: string;
  type: RevenueType;
  contractCode: string;
  contractValue: number;
  amountCollected: number;
  date: string;
  isApproved: boolean;
  relatedContractId?: string;
  customerName?: string;
  phone?: string;
}

export interface ProjectProfile {
  contractCode: string; 
  userId: string;
  
  customerName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  address?: string;
  source?: string;

  industry?: string; 
  region?: string; 
  designLink?: string;
  webLink?: string;
  webPassword?: string;
  hostingSize?: string;
  zaloGroup?: string;
  jointSigner?: string; 
  status?: string;
  
  // Fields for manual override
  signDate?: string;
  handoverDate?: string;
  
  // Added field
  contractValue?: number;
}

export interface Message {
  id: string;
  senderId: string; 
  senderName: string;
  receiverId: string | 'ALL' | string[]; 
  content: string;
  timestamp: string;
  isRead: boolean;
  parentId?: string; 
}

export interface ActivityLog {
  id: string;
  actorId: string;    // ID người thực hiện
  actorName: string;  // Tên người thực hiện
  action: 'TẠO' | 'CẬP NHẬT' | 'XÓA';
  targetType: 'HẸN' | 'TƯ VẤN' | 'DOANH THU' | 'DỰ ÁN' | 'HỆ THỐNG';
  targetId: string;   // ID đối tượng bị tác động
  description: string; // Chi tiết thay đổi (VD: Sửa tên khách hàng A -> B)
  timestamp: string;
}

export interface MonthlyTarget {
  id: string; // Format: USERID_YYYY_MM
  userId: string;
  monthStr: string; // YYYY-MM
  targetAppointment: number;
  targetConsultation: number;
  targetRevenue: number;
}