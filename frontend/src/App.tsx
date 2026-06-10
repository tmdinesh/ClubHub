import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

// Public pages
import EventDiscovery from "@/pages/EventDiscovery";
import EventDetail from "@/pages/EventDetail";
import CertificateVerify from "@/pages/CertificateVerify";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import DevLogin from "@/pages/DevLogin";
import AttendanceLogin from "@/pages/AttendanceLogin";
import AttendanceScan from "@/pages/AttendanceScan";

// Participant dashboard
import Dashboard from "@/pages/dashboard/Dashboard";
import MyEvents from "@/pages/dashboard/MyEvents";
import MyTeams from "@/pages/dashboard/MyTeams";
import CertificateVault from "@/pages/dashboard/CertificateVault";
import Notifications from "@/pages/dashboard/Notifications";
import BrowseEvents from "@/pages/dashboard/BrowseEvents";

// Organizer / manage
import EventOverview from "@/pages/manage/EventOverview";
import RegistrationList from "@/pages/manage/RegistrationList";
import AttendanceDashboard from "@/pages/manage/AttendanceDashboard";
import FinancePage from "@/pages/manage/FinancePage";
import CertificatesManage from "@/pages/manage/CertificatesManage";
import AnnouncementsPage from "@/pages/manage/AnnouncementsPage";
import VolunteersPage from "@/pages/manage/VolunteersPage";
import AttendanceTakersPage from "@/pages/manage/AttendanceTakersPage";

// Faculty / Admin
import FacultyApprovals from "@/pages/faculty/FacultyApprovals";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ClubAdminDashboard from "@/pages/club/ClubAdminDashboard";
import OrganizerDashboard from "@/pages/organizer/OrganizerDashboard";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<EventDiscovery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route path="/attendance-login" element={<AttendanceLogin />} />
        <Route path="/attendance/:eventId" element={<AttendanceScan />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        <Route path="/verify/:code" element={<CertificateVerify />} />

        {/* Participant dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/events" element={<ProtectedRoute><MyEvents /></ProtectedRoute>} />
        <Route path="/dashboard/browse" element={<ProtectedRoute><BrowseEvents /></ProtectedRoute>} />
        <Route path="/dashboard/teams" element={<ProtectedRoute><MyTeams /></ProtectedRoute>} />
        <Route path="/dashboard/certificates" element={<ProtectedRoute><CertificateVault /></ProtectedRoute>} />
        <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Manage / organizer */}
        <Route path="/manage/:eventId/overview" element={<ProtectedRoute><EventOverview /></ProtectedRoute>} />
        <Route path="/manage/:eventId/registrations" element={<ProtectedRoute><RegistrationList /></ProtectedRoute>} />
        <Route path="/manage/:eventId/attendance" element={<ProtectedRoute><AttendanceDashboard /></ProtectedRoute>} />
        <Route path="/manage/:eventId/attendance-takers" element={<ProtectedRoute><AttendanceTakersPage /></ProtectedRoute>} />
        <Route path="/manage/:eventId/volunteers" element={<ProtectedRoute><VolunteersPage /></ProtectedRoute>} />
        <Route path="/manage/:eventId/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
        <Route path="/manage/:eventId/certificates" element={<ProtectedRoute><CertificatesManage /></ProtectedRoute>} />
        <Route path="/manage/:eventId/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

        {/* Faculty */}
        <Route path="/faculty/approvals" element={<ProtectedRoute><FacultyApprovals /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/club" element={<ProtectedRoute><ClubAdminDashboard /></ProtectedRoute>} />
        <Route path="/organizer" element={<ProtectedRoute><OrganizerDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
