import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

// Public pages
import EventDiscovery from "@/pages/EventDiscovery";
import EventDetail from "@/pages/EventDetail";
import CertificateVerify from "@/pages/CertificateVerify";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import AttendanceLogin from "@/pages/AttendanceLogin";
import AttendanceScan from "@/pages/AttendanceScan";
import Onboarding from "@/pages/Onboarding";

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
import FeedbackResults from "@/pages/manage/FeedbackResults";
import MassAttendance from "@/pages/manage/MassAttendance";
import FeedbackForm from "@/pages/dashboard/FeedbackForm";
import AttendanceSelfMark from "@/pages/AttendanceSelfMark";

// Faculty / Admin
import FacultyApprovals from "@/pages/faculty/FacultyApprovals";
import FacultyAnalytics from "@/pages/faculty/FacultyAnalytics";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import DevLogin from "@/pages/DevLogin";
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
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
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
        <Route path="/manage/:eventId/feedback" element={<ProtectedRoute><FeedbackResults /></ProtectedRoute>} />
        <Route path="/manage/:eventId/mass-attendance" element={<ProtectedRoute><MassAttendance /></ProtectedRoute>} />

        {/* Student self-mark attendance */}
        <Route path="/attend" element={<AttendanceSelfMark />} />

        {/* Participant feedback */}
        <Route path="/dashboard/feedback/:eventId" element={<ProtectedRoute><FeedbackForm /></ProtectedRoute>} />

        {/* Faculty */}
        <Route path="/faculty/approvals" element={<ProtectedRoute><FacultyApprovals /></ProtectedRoute>} />
        <Route path="/faculty/analytics" element={<ProtectedRoute><FacultyAnalytics /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/club" element={<ProtectedRoute><ClubAdminDashboard /></ProtectedRoute>} />
        <Route path="/organizer" element={<ProtectedRoute><OrganizerDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
