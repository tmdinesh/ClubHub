from enum import StrEnum


class UserRole(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    FACULTY_ADVISOR = "FACULTY_ADVISOR"
    CLUB_ADMIN = "CLUB_ADMIN"
    EVENT_HEAD = "EVENT_HEAD"
    EVENT_COORDINATOR = "EVENT_COORDINATOR"
    VOLUNTEER_LEAD = "VOLUNTEER_LEAD"
    FINANCE_LEAD = "FINANCE_LEAD"
    ATTENDANCE_TEAM = "ATTENDANCE_TEAM"
    PARTICIPANT = "PARTICIPANT"


class EventStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PUBLISHED = "PUBLISHED"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"


class EventType(StrEnum):
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"


class AttendanceMode(StrEnum):
    SCANNER = "SCANNER"
    MASS = "MASS"


class RegistrationStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    WAITLISTED = "WAITLISTED"
    ATTENDED = "ATTENDED"


class TeamStatus(StrEnum):
    FORMING = "FORMING"
    READY = "READY"
    SUBMITTED = "SUBMITTED"
    DISQUALIFIED = "DISQUALIFIED"


class InvitationStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"


class AttendanceStatus(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"


class CertificateType(StrEnum):
    PARTICIPATION = "PARTICIPATION"
    VOLUNTEER = "VOLUNTEER"
    WINNER = "WINNER"
    RUNNER_UP = "RUNNER_UP"


class ExpenseCategory(StrEnum):
    FOOD = "FOOD"
    VENUE = "VENUE"
    LOGISTICS = "LOGISTICS"
    MARKETING = "MARKETING"
    PRIZES = "PRIZES"
    EQUIPMENT = "EQUIPMENT"
    MISCELLANEOUS = "MISCELLANEOUS"


class NotificationChannel(StrEnum):
    EMAIL = "EMAIL"
    IN_APP = "IN_APP"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ExpenseStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SponsorStatus(StrEnum):
    PROSPECTIVE = "PROSPECTIVE"
    CONFIRMED = "CONFIRMED"
    DECLINED = "DECLINED"


class VolunteerStatus(StrEnum):
    APPLIED = "APPLIED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class QuestionType(StrEnum):
    TEXT = "TEXT"
    RATING = "RATING"
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    YES_NO = "YES_NO"
