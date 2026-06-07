export type StaffRole = "print_master" | "printer" | "issue_operator" | "reception" | "admin";

export type StaffMember = {
  id: number;
  fullName: string;
  phone: string;
  role: StaffRole;
};

const STORAGE_KEY = "factory_staff_members";

export const defaultStaff: StaffMember[] = [
  { id: 1, fullName: "Иван Петров", phone: "+7 900 123-45-67", role: "admin" },
  { id: 2, fullName: "Мария Орлова", phone: "+7 901 333-22-11", role: "reception" },
];

export function loadStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStaff;
    const parsed = JSON.parse(raw) as StaffMember[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultStaff;
    return parsed;
  } catch {
    return defaultStaff;
  }
}

export function saveStaff(staff: StaffMember[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
}
