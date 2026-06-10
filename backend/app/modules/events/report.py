from __future__ import annotations

import io
from datetime import date, datetime, timezone
from typing import Any

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor


def _set_cell_bg(cell, hex_color: str) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def _heading(doc: Document, text: str, level: int) -> None:
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        if level == 1:
            run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)
        else:
            run.font.color.rgb = RGBColor(0x2C, 0x3E, 0x50)


def _fmt_dt(dt_val: datetime | None) -> str:
    if dt_val is None:
        return "—"
    if dt_val.tzinfo is None:
        dt_val = dt_val.replace(tzinfo=timezone.utc)
    return dt_val.astimezone(timezone.utc).strftime("%d %b %Y, %I:%M %p IST")


def _fmt_date(dt_val: datetime | None) -> str:
    if dt_val is None:
        return "—"
    if dt_val.tzinfo is None:
        dt_val = dt_val.replace(tzinfo=timezone.utc)
    return dt_val.strftime("%d %b %Y")


def _add_kv_table(doc: Document, rows: list[tuple[str, str]]) -> None:
    table = doc.add_table(rows=len(rows), cols=2)
    table.style = "Table Grid"
    for i, (label, value) in enumerate(rows):
        table.rows[i].cells[0].text = label
        table.rows[i].cells[1].text = value
        _set_cell_bg(table.rows[i].cells[0], "E8EAF0")
        table.rows[i].cells[0].paragraphs[0].runs[0].bold = True
        table.rows[i].cells[0].width = Inches(2.0)
        table.rows[i].cells[1].width = Inches(4.5)


def generate_club_report(
    club_name: str,
    department: str | None,
    start_date: date,
    end_date: date,
    events: list[dict[str, Any]],
) -> bytes:
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1.2)
        section.right_margin = Inches(1.2)

    # Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_p.add_run(club_name)
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run("Annual Club Activity Report")
    sub_run.font.size = Pt(13)
    sub_run.italic = True
    sub_run.font.color.rgb = RGBColor(0x55, 0x55, 0x77)

    period_p = doc.add_paragraph()
    period_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    period_run = period_p.add_run(
        f"Period: {start_date.strftime('%d %B %Y')} — {end_date.strftime('%d %B %Y')}"
    )
    period_run.font.size = Pt(11)
    period_run.font.color.rgb = RGBColor(0x44, 0x44, 0x66)

    if department:
        dept_p = doc.add_paragraph()
        dept_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        dept_run = dept_p.add_run(f"Department: {department}")
        dept_run.font.size = Pt(10)
        dept_run.font.color.rgb = RGBColor(0x66, 0x66, 0x88)

    doc.add_paragraph()
    doc.add_paragraph("─" * 80)
    doc.add_paragraph()

    # Summary section
    doc.add_heading("Summary", level=1)
    total_regs = sum(e.get("total_registrations", 0) for e in events)
    total_confirmed = sum(e.get("confirmed_registrations", 0) for e in events)
    total_present = sum(e.get("attendance_present", 0) for e in events)

    _add_kv_table(doc, [
        ("Total Events in Period", str(len(events))),
        ("Total Registrations",    str(total_regs)),
        ("Confirmed Registrations", str(total_confirmed)),
        ("Total Attendance",       str(total_present)),
    ])
    doc.add_paragraph()

    if not events:
        doc.add_paragraph("No events found for the selected period.", style="Body Text")
        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()

    # Per-event sections
    doc.add_heading("Event Details", level=1)

    for idx, ev in enumerate(events, 1):
        doc.add_heading(f"{idx}. {ev['title']}", level=2)

        meta_rows = [
            ("Status",   ev.get("status", "—").replace("_", " ")),
            ("Date",     f"{_fmt_date(ev.get('start_datetime'))} – {_fmt_date(ev.get('end_datetime'))}"),
            ("Venue",    ev.get("venue") or "—"),
            ("Category", ev.get("category") or "—"),
            ("Type",     ev.get("event_type", "—")),
        ]
        if ev.get("max_participants"):
            meta_rows.append(("Max Participants", str(ev["max_participants"])))
        _add_kv_table(doc, meta_rows)
        doc.add_paragraph()

        # Description
        if ev.get("description"):
            doc.add_heading("Description", level=3)
            doc.add_paragraph(ev["description"], style="Body Text")

        # Agenda
        if ev.get("agenda"):
            doc.add_heading("Agenda", level=3)
            doc.add_paragraph(ev["agenda"], style="Body Text")

        # Registration & Attendance stats
        doc.add_heading("Registration & Attendance", level=3)
        regs = ev.get("total_registrations", 0)
        confirmed = ev.get("confirmed_registrations", 0)
        present = ev.get("attendance_present", 0)
        att_rate = (present / confirmed * 100) if confirmed else 0

        table = doc.add_table(rows=2, cols=4)
        table.style = "Table Grid"
        headers = ["Total Registered", "Confirmed", "Present", "Attendance Rate"]
        values = [str(regs), str(confirmed), str(present), f"{att_rate:.1f}%"]
        for i, (h, v) in enumerate(zip(headers, values)):
            hdr_cell = table.rows[0].cells[i]
            hdr_cell.text = h
            _set_cell_bg(hdr_cell, "2C3E50")
            hdr_cell.paragraphs[0].runs[0].bold = True
            hdr_cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            table.rows[1].cells[i].text = v
        doc.add_paragraph()

        # Team event info
        if ev.get("is_team_event"):
            doc.add_heading("Team Information", level=3)
            _add_kv_table(doc, [
                ("Team Event",       "Yes"),
                ("Min Team Size",    str(ev.get("team_min_size", "—"))),
                ("Max Team Size",    str(ev.get("team_max_size", "—"))),
                ("Total Teams",      str(ev.get("total_teams", 0))),
                ("Avg Team Size",    str(ev.get("avg_team_size", 0))),
            ])
            doc.add_paragraph()

        # Finance
        budget = ev.get("budget", 0)
        spent = ev.get("spent", 0)
        if budget or spent:
            doc.add_heading("Finance", level=3)
            remaining = budget - spent
            utilization = (spent / budget * 100) if budget else 0
            fmt = lambda n: f"₹{n:,.0f}"
            _add_kv_table(doc, [
                ("Total Budget",  fmt(budget)),
                ("Amount Spent",  fmt(spent)),
                ("Remaining",     fmt(remaining)),
                ("Utilization",   f"{utilization:.1f}%"),
            ])
            doc.add_paragraph()

        # NPS
        nps = ev.get("nps")
        if nps is not None:
            doc.add_heading("Feedback", level=3)
            _add_kv_table(doc, [("Net Promoter Score (NPS)", str(nps))])
            doc.add_paragraph()

        if idx < len(events):
            doc.add_page_break()

    # Footer note
    doc.add_paragraph()
    footer_p = doc.add_paragraph(
        f"Generated on {datetime.now().strftime('%d %B %Y at %I:%M %p')} by ClubHub"
    )
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in footer_p.runs:
        run.font.size = Pt(9)
        run.italic = True
        run.font.color.rgb = RGBColor(0x99, 0x99, 0xAA)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
