export type AccessRole = 'Admin' | 'HR' | 'User';
export type PersonType = 'Employee' | 'Trainee';
export type EmploymentStatus = 'Incoming' | 'Trainee' | 'Employee' | 'Inactive';

export type PersonnelIdentity = {
    id: string;
    corePersonId: string;
    employeeOrTraineeId: string;
    fullName: string;
    email: string;
    position: string;
    department: string;
    accessRole: AccessRole;
    personType: PersonType;
    employmentStatus: EmploymentStatus;
    evaluatorCapable?: boolean;
    managerPersonnelKey?: string | null;
    managerName?: string | null;
};

export const BASE_8_IDENTITIES: PersonnelIdentity[] = [
    { id: 'user-1', corePersonId: 'CORE-001', employeeOrTraineeId: 'EMP-001', fullName: 'Mara Villanueva', email: 'mara.villanueva@alibaton.com', position: 'System Administrator', department: 'Administration', accessRole: 'Admin', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-2', corePersonId: 'CORE-002', employeeOrTraineeId: 'EMP-002', fullName: 'Alvin Custodio', email: 'alvin.custodio@alibaton.com', position: 'System Administrator', department: 'Information Technology', accessRole: 'Admin', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-4', corePersonId: 'CORE-014', employeeOrTraineeId: 'EMP-004', fullName: 'Celso Ramirez', email: 'celso.ramirez@alibaton.com', position: 'HR Business Partner', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-5', corePersonId: 'CORE-112', employeeOrTraineeId: 'EMP-005', fullName: 'Nina Soriano', email: 'nina.soriano@alibaton.com', position: 'Finance Staff', department: 'Finance', accessRole: 'User', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-6', corePersonId: 'CORE-204', employeeOrTraineeId: 'TRN-001', fullName: 'Elaine Bautista', email: 'elaine.bautista@alibaton.com', position: 'Graduate Trainee', department: 'Operations', accessRole: 'User', personType: 'Trainee', employmentStatus: 'Trainee' },
    { id: 'user-8', corePersonId: 'CORE-154', employeeOrTraineeId: 'EMP-006', fullName: 'Miguel Santos', email: 'miguel.santos@alibaton.com', position: 'Safety Officer', department: 'Safety & Compliance', accessRole: 'User', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-10', corePersonId: 'CORE-027', employeeOrTraineeId: 'EMP-008', fullName: 'Grace Fernandez', email: 'grace.fernandez@alibaton.com', position: 'Training Officer', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee' },
    { id: 'user-12', corePersonId: 'CORE-238', employeeOrTraineeId: 'EMP-010', fullName: 'Katrina Buenaventura', email: 'katrina.buenaventura@alibaton.com', position: 'HR Business Partner', department: 'Human Resources', accessRole: 'HR', personType: 'Employee', employmentStatus: 'Employee' },
];

const GEN_NAMES = ["Luis Gomez", "Sofia Reyes", "Mateo Cruz", "Isabella Torres", "Lucas Flores", "Mia Ramos", "Gabriel Morales", "Camila Ortiz", "Jose Castillo", "Elena Chavez", "Antonio Ruiz", "Valeria Herrera", "Carlos Medina", "Mariana Aguilar", "Jorge Vargas", "Lucia Castro", "Pedro Salazar", "Valentina Guzman", "Juan Pena", "Ximena Rojas", "Diego Mendez", "Mariana Silva", "Alejandro Rios", "Daniela Navarro", "Fernando Delgado", "Victoria Nunez", "Ricardo Padilla"];
const GEN_DEPARTMENTS = ["Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Logistics", "Operations", "Finance", "Contracts", "Safety & Compliance", "Administration", "Information Technology", "Crane Operations", "Operations", "Logistics"];
const GEN_POSITIONS = [
    'Crane Operator', 'Logistics Coordinator', 'Operations Coordinator', 'Finance Analyst',
    'Contracts Officer', 'Safety Inspector', 'Administrative Assistant', 'IT Support Specialist',
    'Crane Operations Supervisor', 'Logistics Supervisor', 'Operations Supervisor', 'Finance Manager',
    'Contracts & Compliance Supervisor', 'Safety Supervisor', 'Administrative Services Supervisor', 'IT Operations Supervisor',
    'Rigger and Signalperson', 'Dispatch Coordinator', 'Project Site Coordinator', 'Accounts Payable Specialist',
    'Contract Documentation Specialist', 'Safety Compliance Specialist', 'Records Coordinator', 'Systems Analyst',
    'Crane Maintenance Coordinator', 'Project Controls Coordinator', 'Fleet Scheduling Coordinator',
];

export const GENERATED_IDENTITIES: PersonnelIdentity[] = GEN_NAMES.map((name, i) => ({
    id: `user-gen-${i}`,
    corePersonId: `CORE-GEN-${i}`,
    employeeOrTraineeId: `EMP-1${i.toString().padStart(2, '0')}`,
    fullName: name,
    email: `${name.toLowerCase().replace(' ', '.')}@alibaton.com`,
    position: GEN_POSITIONS[i],
    department: GEN_DEPARTMENTS[i],
    accessRole: 'User',
    personType: 'Employee',
    employmentStatus: 'Employee'
}));

export const SHARED_PERSONNEL: PersonnelIdentity[] = [...BASE_8_IDENTITIES, ...GENERATED_IDENTITIES];
export function replaceSharedPersonnel(personnel: PersonnelIdentity[]): void {
    SHARED_PERSONNEL.splice(0, SHARED_PERSONNEL.length, ...personnel);
}

export function initialsFor(name: string): string {
    return name.split(' ').map((v) => v[0]).slice(0, 2).join('').toUpperCase();
}

export function colorForId(seed: string): string {
    const colorVals = ['#f59e0b', '#0ea5e9', '#10b981', '#d946ef', '#f43f5e', '#8b5cf6'];
    const i = seed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colorVals.length;
    return colorVals[i];
}

export function getPersonById(id: string): PersonnelIdentity | undefined {
    return SHARED_PERSONNEL.find((p) => p.id === id);
}
