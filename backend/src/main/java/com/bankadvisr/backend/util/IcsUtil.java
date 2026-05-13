package com.bankadvisr.backend.util;

import com.bankadvisr.backend.dto.rdv.RendezVousDTO;
import java.time.*;
import java.time.format.DateTimeFormatter;

public class IcsUtil {
  private static final DateTimeFormatter F = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

  public static String build(RendezVousDTO rdv, ZoneId zone) {
    LocalDate d = LocalDate.parse(rdv.getDate());
    LocalTime h1 = LocalTime.parse(rdv.getHeureDebut());
    LocalTime h2 = LocalTime.parse(rdv.getHeureFin());
    String dtStart = ZonedDateTime.of(d, h1, zone).withZoneSameInstant(ZoneOffset.UTC).format(F);
    String dtEnd   = ZonedDateTime.of(d, h2, zone).withZoneSameInstant(ZoneOffset.UTC).format(F);

    String summary = "Rendez-vous " + (rdv.getType() != null ? "(" + rdv.getType() + ")" : "");
    String desc = rdv.getLienVisio() != null ? "Visio: " + rdv.getLienVisio() : "";

    return "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AppConsulting//RDV//FR\nBEGIN:VEVENT\n"
        + "UID:" + rdv.getId() + "@appconsulting\n"
        + "DTSTAMP:" + dtStart + "\n"
        + "DTSTART:" + dtStart + "\n"
        + "DTEND:" + dtEnd + "\n"
        + "SUMMARY:" + summary + "\n"
        + "DESCRIPTION:" + desc + "\n"
        + "END:VEVENT\nEND:VCALENDAR\n";
  }
}
