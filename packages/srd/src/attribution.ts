/** Exact statement from SRD 5.2.1 p.1 "Legal Information". Do not edit. */
export const SRD_ATTRIBUTION =
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

/** CC-BY-4.0 section 3(a)(1)(B) change notice. Not attribution to Wizards. */
export const SRD_CHANGE_NOTICE =
  "The records in this package restructure SRD 5.2.1 text into data records for the-stacks. The restructuring is not endorsed by the licensor.";

/** Upstream dataset credit, or null if the records were transcribed from the PDF directly. */
export const SRD_DATA_SOURCE: {
  name: string;
  url: string;
  commit: string;
  license: string;
} | null = null;
