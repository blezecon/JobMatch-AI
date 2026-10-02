import type { Candidate } from "@/types";

function Item({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">None found.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CandidateProfile({ candidate }: { candidate: Candidate }) {
  // Models sometimes emit a blank record; an empty card is worse than no card.
  const hasText = (values: string[]) => values.some((value) => value.trim());
  const experience = candidate.experience.filter((item) => hasText([item.title, item.company]));
  const projects = candidate.projects.filter((item) => hasText([item.name, item.description]));
  const education = candidate.education.filter((item) => hasText([item.institution, item.degree]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{candidate.name}</h2>
        {candidate.summary ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{candidate.summary}</p>
        ) : null}
      </div>

      <section aria-labelledby="skills-heading">
        <h3 id="skills-heading" className="mb-2 font-medium">
          Skills
        </h3>
        <Chips items={candidate.skills} />
      </section>

      {experience.length > 0 ? (
        <section aria-labelledby="experience-heading">
          <h3 id="experience-heading" className="mb-2 font-medium">
            Experience
          </h3>
          <ul className="space-y-3">
            {experience.map((item, index) => (
              <li
                key={`${item.company}-${index}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <p className="text-sm font-medium">
                  {item.title}
                  {item.company ? ` · ${item.company}` : ""}
                </p>
                {item.period ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.period}</p>
                ) : null}
                {item.highlights.length > 0 ? (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {item.highlights.map((highlight, hIndex) => (
                      <li key={hIndex}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section aria-labelledby="projects-heading">
          <h3 id="projects-heading" className="mb-2 font-medium">
            Projects
          </h3>
          <ul className="space-y-3">
            {projects.map((project, index) => (
              <li
                key={`${project.name}-${index}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <p className="text-sm font-medium">{project.name}</p>
                {project.description ? (
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {project.description}
                  </p>
                ) : null}
                {project.technologies.length > 0 ? (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {project.technologies.join(" · ")}
                  </p>
                ) : null}
                {project.url ? (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-xs underline underline-offset-2"
                  >
                    Project link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {education.length > 0 ? (
        <section aria-labelledby="education-heading">
          <h3 id="education-heading" className="mb-2 font-medium">
            Education
          </h3>
          <ul className="space-y-2">
            {education.map((item, index) => (
              <li
                key={`${item.institution}-${index}`}
                className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <p className="font-medium">
                  {[item.degree, item.field].filter(Boolean).join(" in ") || item.institution}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[item.institution, item.year].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {candidate.certifications.length > 0 ? (
        <section aria-labelledby="certs-heading">
          <h3 id="certs-heading" className="mb-2 font-medium">
            Certifications
          </h3>
          <dl className="space-y-2">
            {candidate.certifications.map((item, index) => (
              <div key={`${item.name}-${index}`} className="text-sm">
                <Item label="Certification" value={item.name} />
                <Item label="Issuer" value={item.issuer} />
                <Item label="Year" value={item.year} />
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}