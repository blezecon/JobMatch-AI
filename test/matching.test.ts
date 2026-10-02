import { describe, expect, it } from "vitest";
import { isSkillLike, matchCandidateToJob, matchSkill, normalizeSkill } from "@/lib/matching";
import { candidateSchema, jobRequirementsSchema } from "@/lib/schema";
import type { Candidate, JobRequirements } from "@/types";

const candidate = (skills: string[]): Candidate => ({
  name: "Test",
  summary: "",
  skills,
  education: [],
  experience: [],
  projects: [],
  certifications: [],
});

const requirements = (overrides: Partial<JobRequirements> = {}): JobRequirements => ({
  title: "Frontend Developer",
  company: "Acme",
  location: "Remote",
  experienceRequirements: [],
  requiredSkills: ["React", "JavaScript", "Git"],
  preferredSkills: [],
  educationRequirements: [],
  responsibilities: [],
  ...overrides,
});

describe("normalizeSkill", () => {
  it("lowercases and trims", () => {
    expect(normalizeSkill("  React  ")).toBe("react");
    expect(normalizeSkill("JavaScript")).toBe("javascript");
  });

  it("maps the documented aliases", () => {
    expect(normalizeSkill("JS")).toBe("javascript");
    expect(normalizeSkill("TS")).toBe("typescript");
    expect(normalizeSkill("ReactJS")).toBe("react");
    expect(normalizeSkill("Node")).toBe("node.js");
    expect(normalizeSkill("K8s")).toBe("kubernetes");
    expect(normalizeSkill("NextJS")).toBe("next.js");
  });

  it("keeps meaningful punctuation like C++ and Next.js", () => {
    expect(normalizeSkill("C++")).toBe("c++");
    expect(normalizeSkill("Next.js")).toBe("next.js");
  });

  it("normalizes whitespace and stray punctuation", () => {
    expect(normalizeSkill("Git  (version control)")).toBe("git version control");
  });
});

describe("matchSkill", () => {
  it("matches on the normalized form, not the raw string", () => {
    expect(matchSkill(["ReactJS"], "react")).toBe("match");
    expect(matchSkill(["react"], "ReactJS")).toBe("match");
    expect(matchSkill(["Node"], "Node.js")).toBe("match");
  });

  it("treats a narrower requirement as a partial match", () => {
    expect(matchSkill(["React"], "React Native")).toBe("partial");
  });

  it("counts a broader skill as covering a narrower requirement", () => {
    // React Native experience really does cover a plain React requirement.
    expect(matchSkill(["React Native"], "React")).toBe("match");
  });

  it("does not claim Java covers JavaScript", () => {
    expect(matchSkill(["Java"], "JavaScript")).toBe("none");
  });

  it("returns none for unrelated skills", () => {
    expect(matchSkill(["React", "Git"], "Kubernetes")).toBe("none");
  });

  it("matches a requirement sentence whose every keyword is owned", () => {
    expect(matchSkill(["TypeScript"], "experience with TypeScript")).toBe("match");
  });

  it("only partially matches a requirement sentence with an uncovered keyword", () => {
    expect(matchSkill(["JavaScript"], "JavaScript in production")).toBe("partial");
  });

  it("does not confuse TypeScript with JavaScript", () => {
    expect(matchSkill(["TypeScript"], "JavaScript in production")).toBe("none");
  });

  it("returns none for an empty requirement", () => {
    expect(matchSkill(["React"], "  ")).toBe("none");
  });
});

describe("matchCandidateToJob", () => {
  it("splits matched and missing skills", () => {
    const result = matchCandidateToJob(
      candidate(["React", "JavaScript", "Git"]),
      requirements({ requiredSkills: ["React", "JavaScript", "Git", "TypeScript"] }),
    );
    expect(result.matches.map((m) => m.requirement).sort()).toEqual(["Git", "JavaScript", "React"]);
    expect(result.missingRequirements).toEqual(["TypeScript"]);
  });

  it("the documented spec example end to end", () => {
    const result = matchCandidateToJob(
      candidate(["React", "JavaScript", "Git"]),
      requirements({ requiredSkills: ["React", "JavaScript", "Git", "TypeScript"] }),
    );
    expect(result.matches.map((m) => m.requirement)).toContain("React");
    expect(result.missingRequirements).toEqual(["TypeScript"]);
  });

  it("reports an experience requirement as missing when no experience exists", () => {
    const result = matchCandidateToJob(
      candidate(["React"]),
      requirements({
        requiredSkills: [],
        experienceRequirements: ["2+ years of professional experience"],
      }),
    );
    expect(result.missingRequirements).toEqual(["2+ years of professional experience"]);
  });

  it("keeps satisfied experience requirements out of the missing list", () => {
    const result = matchCandidateToJob(
      candidate(["React", "JavaScript"]),
      requirements({
        requiredSkills: [],
        experienceRequirements: ["JavaScript in production"],
      }),
    );
    expect(result.missingRequirements).toEqual([]);
  });

  it("never reports a requirement the candidate partly covers as missing", () => {
    const result = matchCandidateToJob(
      candidate(["JavaScript"]),
      requirements({ requiredSkills: ["JavaScript in production"] }),
    );
    expect(result.missingRequirements).toEqual([]);
    expect(result.partialMatches.map((p) => p.requirement)).toEqual(["JavaScript in production"]);
  });

  it("separates missing preferred skills from missing requirements", () => {
    const result = matchCandidateToJob(
      candidate(["React"]),
      requirements({ requiredSkills: ["React"], preferredSkills: ["GraphQL"] }),
    );
    expect(result.missingRequirements).toEqual([]);
    expect(result.missingPreferred).toEqual(["GraphQL"]);
  });

  it("scores full required coverage at 100", () => {
    const result = matchCandidateToJob(candidate(["React", "JavaScript", "Git"]), requirements());
    expect(result.fitScore).toBe(100);
  });

  it("scores zero when nothing matches", () => {
    const result = matchCandidateToJob(candidate(["COBOL"]), requirements());
    expect(result.fitScore).toBe(0);
    expect(result.missingRequirements.sort()).toEqual(["Git", "JavaScript", "React"]);
  });

  it("does not let preferred skills move the score", () => {
    const required = requirements({ requiredSkills: ["React", "TypeScript"] });
    const withUnmetPreferred = matchCandidateToJob(candidate(["React"]), {
      ...required,
      preferredSkills: ["GraphQL", "AWS"],
    });
    const withoutPreferred = matchCandidateToJob(candidate(["React"]), required);
    const withMetPreferred = matchCandidateToJob(
      candidate(["React", "GraphQL", "AWS"]),
      { ...required, preferredSkills: ["GraphQL", "AWS"] },
    );
    expect(withUnmetPreferred.fitScore).toBe(50);
    expect(withUnmetPreferred.fitScore).toBe(withoutPreferred.fitScore);
    expect(withMetPreferred.fitScore).toBe(withUnmetPreferred.fitScore);
  });

  it("falls back to preferred coverage when nothing is required", () => {
    const result = matchCandidateToJob(
      candidate(["React", "GraphQL"]),
      requirements({ requiredSkills: [], preferredSkills: ["React", "GraphQL", "AWS"] }),
    );
    expect(result.fitScore).toBe(67);
  });

  it("scores zero when the job lists neither required nor preferred skills", () => {
    const result = matchCandidateToJob(
      candidate(["React"]),
      requirements({ requiredSkills: [], preferredSkills: [] }),
    );
    expect(result.fitScore).toBe(0);
  });

  it("attaches candidate evidence to each match", () => {
    const result = matchCandidateToJob(
      candidate(["ReactJS"]),
      requirements({ requiredSkills: ["React"] }),
    );
    expect(result.matches[0].evidence).toContain("ReactJS");
  });

  it("deduplicates repeated requirements", () => {
    const result = matchCandidateToJob(
      candidate(["React"]),
      requirements({ requiredSkills: ["React", "react", "ReactJS"] }),
    );
    expect(result.matches).toHaveLength(1);
  });

  it("shortlists experience and projects that mention matched skills", () => {
    const withWork: Candidate = {
      ...candidate(["React", "Git"]),
      experience: [
        {
          company: "Acme",
          title: "Frontend Developer",
          period: "2024",
          highlights: ["Shipped a React dashboard"],
        },
        { company: "Other", title: "Barista", period: "2022", highlights: ["Made coffee"] },
      ],
      projects: [{ name: "Feedback System", description: "React app", technologies: ["React"], url: "" }],
    };
    const result = matchCandidateToJob(withWork, requirements({ requiredSkills: ["React"] }));
    expect(result.relevantExperience.map((e) => e.company)).toEqual(["Acme"]);
    expect(result.relevantProjects.map((p) => p.name)).toEqual(["Feedback System"]);
  });

  it("returns nothing relevant when no skill matches", () => {
    const withWork: Candidate = {
      ...candidate(["COBOL"]),
      experience: [
        { company: "Acme", title: "Mainframes", period: "1990", highlights: ["COBOL batch jobs"] },
      ],
      projects: [],
    };
    const result = matchCandidateToJob(withWork, requirements({ requiredSkills: ["React"] }));
    expect(result.relevantExperience).toEqual([]);
  });
});

describe("isSkillLike", () => {
  it("accepts technologies", () => {
    expect(isSkillLike("React")).toBe(true);
    expect(isSkillLike("Tailwind CSS")).toBe(true);
    expect(isSkillLike("C++")).toBe(true);
  });

  it("rejects a whole sentence copied out of a listing", () => {
    // Seen on a Ukrainian listing: the model returned the entire bullet as a
    // "required skill", which then surfaced as a partial match.
    expect(
      isSkillLike(
        "Практичний досвід розробки веб-додатків з використанням фреймворків React та Vue.js",
      ),
    ).toBe(false);
    expect(isSkillLike("Strong communication and teamwork skills required.")).toBe(false);
    expect(isSkillLike("Experience with Kubernetes and Docker")).toBe(false);
  });

  it("rejects the nouns a model mistakes for skills", () => {
    // These appear in postings but are not technologies, so scoring against them
    // would report 0% for a candidate who plainly matches the stack.
    expect(isSkillLike("accessibility")).toBe(false);
    expect(isSkillLike("performance")).toBe(false);
    expect(isSkillLike("communication")).toBe(false);
    expect(isSkillLike("problem solving")).toBe(false);
  });

  it("still accepts a real multi-word skill", () => {
    expect(isSkillLike("Tailwind CSS")).toBe(true);
    expect(isSkillLike("Node.js")).toBe(true);
  });
});

describe("AI output validation", () => {
  it("fills missing fields instead of throwing", () => {
    const parsed = candidateSchema.parse({});
    expect(parsed.name).toBe("Unknown");
    expect(parsed.skills).toEqual([]);
    expect(parsed.experience).toEqual([]);
  });

  it("accepts a bare string where a list is expected", () => {
    const parsed = candidateSchema.parse({ name: "Ada", skills: "React" });
    expect(parsed.name).toBe("Ada");
    expect(parsed.skills).toEqual(["React"]);
  });

it("discards a list field that is neither a string nor an array", () => {
    const parsed = candidateSchema.parse({ name: "Ada", skills: 42 });
    expect(parsed.name).toBe("Ada");
    expect(parsed.skills).toEqual([]);
  });

  it("rejects a non-object payload", () => {
    expect(candidateSchema.safeParse("not an object").success).toBe(false);
    expect(candidateSchema.safeParse(null).success).toBe(false);
  });

  it("strips unexpected keys", () => {
    const parsed = jobRequirementsSchema.parse({
      title: "Dev",
      requiredSkills: ["React"],
      secret: "x",
    });
    expect(parsed).not.toHaveProperty("secret");
    expect(parsed.requiredSkills).toEqual(["React"]);
  });

  it("fills a partial requirements object", () => {
    const parsed = jobRequirementsSchema.parse({ title: "Dev" });
    expect(parsed.requiredSkills).toEqual([]);
    expect(parsed.responsibilities).toEqual([]);
  });

  it("defaults nested records so one bad entry cannot void the array", () => {
    const parsed = candidateSchema.parse({
      experience: [{ company: "Acme", title: "Dev" }, "garbage"],
    });
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].highlights).toEqual([]);
  });
});