export function roleHomePath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "FACULTY_ADVISOR":
      return "/faculty/approvals";
    case "CLUB_ADMIN":
      return "/club";
    case "ATTENDANCE_TEAM":
      return "/organizer";
    default:
      return "/dashboard";
  }
}
