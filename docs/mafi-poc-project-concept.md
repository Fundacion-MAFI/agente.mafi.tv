# The Archive Speaks — Automated Documentary Editing from Archival Collections

## Overview

Documentary archives hold extraordinary stories. Hours of carefully shot footage capturing moments of human experience — communities, landscapes, crises, resilience — sit organized and catalogued, waiting to be found. Existing tools allow researchers and curators to search these collections, surface relevant material, and retrieve individual clips. But retrieval is not storytelling.

This project explores the next step: **given a question or theme, can a system not only find the relevant material but assemble it into a coherent short film?**

We are building a system that takes a natural language query — *"the daily life of fishing communities facing environmental change"* — and responds not with a list of clips, but with an edited sequence: a beginning, a middle, an end. A piece of film that speaks to the question.

---

## The Problem

Documentary archives are underused. The barrier is not access — it is the labor of editing. Turning retrieved footage into a meaningful sequence requires an editor who understands narrative structure, pacing, visual flow, and the specific logic of documentary storytelling. This work takes time, skill, and deep familiarity with the material.

For cultural institutions, research projects, journalism, and education, this creates a bottleneck. Collections grow. Editors are scarce. Stories stay locked inside.

---

## The Idea

We treat documentary editing as a reasoning problem.

A skilled editor looking at a set of clips asks a series of questions: *What is this sequence trying to say? What establishes context? Where is the human moment? How does this end?* These questions have structure. They can be made explicit. And with the right representation of the source material, they can be approached computationally.

The system works in two stages:

**Stage 1 — Understanding the collection.** Each clip in the archive is analyzed and described in depth: what is shown, what is said, what mood it carries, what narrative purpose it could serve. This understanding is generated once, stored, and reused.

**Stage 2 — Responding to a query.** When a user poses a question or theme, the system retrieves the most relevant clips and then reasons about how to sequence them — selecting the opening image, building through context and evidence, finding the emotional or reflective close. The output is an edit plan: an ordered sequence of clips with suggested cut points and a rationale for each decision.

---

## What Makes This Different

Most computational approaches to video treat editing as a matching problem — find similar things and put them together. We are proposing an **editorial reasoning** approach: the system is asked to construct a narrative, not just a playlist.

This means the system must understand:
- That an opener and a closer are different kinds of shots, even if they cover the same subject
- That pacing — the rhythm of cuts — shapes how a viewer experiences meaning
- That the sequence as a whole should arc: establish, develop, resolve

This is a harder problem. It is also a more interesting one.

---

## Why Now

Recent advances in language and vision AI have made it possible to generate rich, structured descriptions of audiovisual content at scale. A clip can now be described not just by its subject tags but by its mood, its visual grammar, the role it might play in a larger sequence. This creates the representational foundation that an editorial reasoning system requires.

At the same time, large language models have demonstrated a capacity for narrative planning — breaking a story into structural beats, assigning roles, constructing arcs — that makes them plausible candidates for the sequencing task.

The combination of these two capabilities, applied to a well-described archive, opens a space that has not previously been explored.

---

## Scope of This Research

This project is a structured investigation into whether this approach works, how well it works, and where it breaks down.

We are working with a specific collection of documentary short films. We will generate a rich descriptive layer for this collection, build a sequencing system on top of it, and produce a set of edited sequences for evaluation. We will ask experienced documentary editors and researchers to assess the results — not just for technical correctness, but for whether the output feels considered, whether it has something to say.

The questions we are genuinely trying to answer:

- Can a system produce edit plans that a human editor would find credible as a starting point?
- How much does the quality of clip description determine the quality of the edit?
- What kinds of queries does the system handle well, and where does it fail?
- What would responsible deployment of such a system look like in an archival context?

---

## Potential Applications

**Cultural heritage institutions** — enabling curators and researchers to explore collections through assembled sequences rather than lists of results.

**Documentary journalism** — rapid assembly of archival material around breaking or developing stories.

**Education** — generating thematic sequences from educational film archives for classroom use.

**Research and oral history** — surfacing narrative patterns across large collections of interview and observational footage.

**Creative development** — giving filmmakers a way to explore an archive's potential before committing to an edit.

---

## Open Questions

This is exploratory research. We are not claiming the system will replace editors — we are asking what it can do, what it cannot, and what it reveals about the relationship between description, retrieval, and narrative.

Some questions remain open by design:

- **Quality and authorship.** Who is responsible for an algorithmically assembled sequence? How should it be attributed?
- **Bias and representation.** Does the system's output reflect the diversity of perspectives in the archive, or does it systematically favor certain kinds of material?
- **The limits of description.** Some of what makes a great documentary cut is not describable in words. How far can language-based reasoning take us before something essential is lost?
- **The editor's role.** Is the most useful version of this system one that produces finished edits, or one that produces proposals that a human editor then refines?

These questions are as important as the technical results. They will shape how we interpret what we build.

---

## Summary

Archives contain stories that have never been told — not because the footage doesn't exist, but because the work of assembling it has always required more time and skill than was available. This project asks whether that work can be shared between human editors and computational systems, and what we learn about both in the process.

The goal is not automation for its own sake. It is access. It is the possibility that a researcher, a journalist, a curator, or a student can pose a question to an archive and receive not a list of files, but a film.
