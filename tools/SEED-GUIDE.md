# Marginalia Seed CSV — Field Guide

## The template file: `tools/seed_template.csv`

Open `seed_template.csv` in Excel, Numbers, or Google Sheets.
One row per reference. Save as CSV when done.
Run: `python tools/import_csv.py tools/seed_template.csv`

---

## Field reference

### id
**Leave this column blank.**
A UUID (Universally Unique Identifier) is generated automatically for every row on import.
A UUID looks like: `550e8400-e29b-41d4-a716-446655440000`

It is not a sequential number (1, 2, 3). Sequential numbers collide when records are
created on different machines or through different import paths. A UUID is globally
unique regardless of where or when it was created. In normal use you will never
see or type a UUID — the tool manages them invisibly.

### title
The full title of the source. Required.
```
Decolonizing Education: Nourishing the Learning Spirit
```

### authors
Required. For multiple authors, separate with semicolons:
```
Battiste, Marie
Couldry, Nick; Mejias, Ulises A.
Mueller, Pam A.; Oppenheimer, Daniel M.
```

### year
Four-digit year. Required.
```
2013
```

### source_type
Required. Use one of:
`journal` `book` `chapter` `web` `conference` `thesis` `report` `other`

### url_doi
Optional. DOI preferred over URL — DOIs are stable, URLs rot.
```
10.1515/9781503609754
https://www.theverge.com/podcast/917029/...
```

### verification_status
Optional. Defaults to `surfaced` if blank.

| Value | Meaning |
|---|---|
| `surfaced` | Source mentioned — not yet located or confirmed |
| `located` | You have it — physical, PDF, or library access confirmed |
| `verified` | You have read enough to confirm it says what was claimed |
| `rejected` | Hallucinated, irrelevant, or superseded |

### physical_holding
Optional. Defaults to `none` if blank.

| Value | Meaning |
|---|---|
| `none` | Not yet obtained |
| `physical` | Book or paper copy on your shelf |
| `pdf` | PDF saved locally or in cloud |
| `ebook` | Kindle, Apple Books, institutional ebook |
| `library-access` | Available via MacEwan/USask library proxy |

### holding_location
Optional. Use the PDF naming convention:
```
Battiste_2013_DecolonizingEducation.pdf
Couldry_2019_CostsOfConnection.pdf
```
Leave blank if you don't have a copy yet.

### annotation
Optional but high value. Your words — what does this source argue?
Write in plain language. This is what appears in the idea map tooltip
and what gets passed to LLMs as context in Phase 6.
```
Critiques cognitive imperialism in education. Mi'kmaw learning spirit
framework proposes holistic trans-systemic educational reform.
```

### argument_connection
Optional but high value. How does this connect to your research argument?
This is the field that makes the idea map meaningful.
```
Anchors the decentring-the-west design principle. The verification pipeline
is a direct response to Battiste's insistence on situated knowledge over
decontextualised fact.
```

### themes
Optional. Semicolon-separated tags. Consistent tags across references
build the idea map edges automatically.
```
cognitive-imperialism;indigenous-pedagogy;decolonial
data-colonialism;surveillance;automation
paper-primary;embodied-cognition;learning
```

---

## Example rows

```csv
id,title,authors,year,source_type,url_doi,verification_status,physical_holding,holding_location,annotation,argument_connection,themes
,Decolonizing Education,"Battiste, Marie",2013,book,,verified,physical,Battiste_2013_DecolonizingEducation.pdf,"Critiques cognitive imperialism in education. Mi'kmaw learning spirit framework.","Anchors decentring-the-west design principle.",cognitive-imperialism;indigenous-pedagogy;decolonial
,The Costs of Connection,"Couldry, Nick; Mejias, Ulises A.",2019,book,10.1515/9781503609754,verified,physical,Couldry_2019_CostsOfConnection.pdf,"Data colonialism as structural extension of historical colonialism.","Theoretical anchor for automation-as-colonialism argument.",data-colonialism;surveillance;automation
,Pedagogy of the Oppressed,"Freire, Paulo",1970,book,,verified,physical,Freire_1970_PedagogyOppressed.pdf,"Banking education deposits decontextualised facts into passive receivers.","Cognitive throughput is banking education with a dashboard.",banking-education;critical-pedagogy;cognitive-throughput
,The Pen Is Mightier Than the Keyboard,"Mueller, Pam A.; Oppenheimer, Daniel M.",2014,journal,10.1177/0956797614524581,verified,pdf,Mueller_2014_PenMightier.pdf,"Handwritten note-takers outperform laptop note-takers on conceptual questions.","Neurological basis for paper-primary principle.",paper-primary;embodied-cognition;note-taking
```

---

## Tips

- **Annotation and argument_connection are where the value lives.**
  A reference with only title and year is inert in the idea map.
  A reference with both fields populated contributes immediately.

- **Consistent theme tags build the map.**
  If ten references share the tag `cognitive-imperialism`, the idea map
  draws ten edges automatically. Inconsistent tags (cognitive-imperialism,
  cog-imperialism, cogImperialism) fragment the map.

- **Seed verified sources first.**
  Start with sources you know well. The annotation and argument_connection
  fields for a source you've read are a 5-minute task. For a surfaced source
  you haven't read yet, leave those fields blank and fill them after you read.

- **The holding_location field links the PDF folder to the reference record.**
  Use the PDF naming convention consistently and the two systems speak the
  same language permanently.
