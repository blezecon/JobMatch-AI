import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Briefcase, FolderGit2, GraduationCap, Lightbulb, Wrench } from "lucide-react";
import type { Candidate } from "@/types";

function Chips({ items }: { items: string[] }) {
  // A model can list the same skill twice ("Python", "python"); duplicate React
  // keys are a real error, and a repeated chip tells the user nothing anyway.
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return <p className="text-sm">None found.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {unique.map((item) => (
        <li key={item}>
          <Badge variant="neutral" className="border-2 border-border shadow-shadow">
            {item}
          </Badge>
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
  const certifications = candidate.certifications.filter((item) => hasText([item.name]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">{candidate.name}</h2>
        {candidate.summary ? <p className="mt-1 text-sm">{candidate.summary}</p> : null}
      </div>

      <section aria-labelledby="skills-heading">
        <h3 id="skills-heading" className="mb-2 flex items-center gap-2 font-heading font-bold">
          <Wrench aria-hidden className="size-4" />
          Skills
        </h3>
        <Chips items={candidate.skills} />
      </section>

      {experience.length > 0 ? (
        <section aria-labelledby="experience-heading" className="space-y-3">
          <h3 id="experience-heading" className="flex items-center gap-2 font-heading font-bold">
            <Briefcase aria-hidden className="size-4" />
            Experience
          </h3>
          <ul className="space-y-3">
            {experience.map((item, index) => (
              <li key={`${item.company}-${index}`}>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {item.title}
                      {item.company ? ` · ${item.company}` : ""}
                    </CardTitle>
                    {item.period ? <CardDescription>{item.period}</CardDescription> : null}
                  </CardHeader>
                  {item.highlights.length > 0 ? (
                    <CardContent>
                      <ul className="list-inside list-disc space-y-0.5 text-sm">
                        {item.highlights.map((highlight, hIndex) => (
                          <li key={hIndex}>{highlight}</li>
                        ))}
                      </ul>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section aria-labelledby="projects-heading" className="space-y-3">
          <h3 id="projects-heading" className="flex items-center gap-2 font-heading font-bold">
            <FolderGit2 aria-hidden className="size-4" />
            Projects
          </h3>
          <ul className="space-y-3">
            {projects.map((project, index) => (
              <li key={`${project.name}-${index}`}>
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {project.description ? (
                      <CardDescription>{project.description}</CardDescription>
                    ) : null}
                  </CardHeader>
                  {project.technologies.length > 0 || project.url ? (
                    <CardContent className="space-y-1 text-sm">
                      {project.technologies.length > 0 ? (
                        <p className="flex flex-wrap gap-1.5">
                          {project.technologies.map((tech) => (
                            <Badge key={tech} variant="neutral">
                              {tech}
                            </Badge>
                          ))}
                        </p>
                      ) : null}
                      {project.url ? (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline underline-offset-2"
                        >
                          Project link
                        </a>
                      ) : null}
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {education.length > 0 ? (
        <section aria-labelledby="education-heading" className="space-y-3">
          <h3 id="education-heading" className="flex items-center gap-2 font-heading font-bold">
            <GraduationCap aria-hidden className="size-4" />
            Education
          </h3>
          <ul className="space-y-2">
            {education.map((item, index) => (
              <li
                key={`${item.institution}-${index}`}
                className="rounded-base border-2 border-border bg-secondary-background p-3"
              >
                <p className="font-heading font-bold">
                  {[item.degree, item.field].filter(Boolean).join(" in ") || item.institution}
                </p>
                <p className="text-sm">
                  {[item.institution, item.year].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {certifications.length > 0 ? (
        <section aria-labelledby="certs-heading" className="space-y-3">
          <h3 id="certs-heading" className="flex items-center gap-2 font-heading font-bold">
            <Lightbulb aria-hidden className="size-4" />
            Certifications
          </h3>
          <ul className="space-y-2">
            {certifications.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="rounded-base border-2 border-border bg-secondary-background p-3 text-sm"
              >
                <p className="font-heading font-bold">{item.name}</p>
                {[item.issuer, item.year].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}