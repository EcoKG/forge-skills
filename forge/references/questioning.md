# Questioning Methodology — Dream Extraction

> This is NOT requirements gathering. This is collaborative dream extraction.
> The goal is to understand what the user REALLY wants, not just what they say they want.

## Principles

1. **Concrete options, not open questions**
   - BAD: "What authentication do you want?"
   - GOOD: Present 3 options via AskUserQuestion:
     - JWT (stateless, good for APIs)
     - Session (stateful, good for traditional web)
     - OAuth2 (third-party, good for social login)

2. **Follow energy**
   - When the user gets excited about a feature, dig deeper
   - When they seem uncertain, offer concrete examples
   - Don't push features the user doesn't care about

3. **Challenge vagueness**
   - "Fast" → "Under 200ms response time? Under 50ms? Under 1 second?"
   - "Secure" → "OWASP Top 10 compliance? SOC2? PCI-DSS? Just input validation?"
   - "Scalable" → "10 users? 1000? 1M? What's the growth timeline?"

4. **Make abstract concrete**
   - "Dashboard" → "3 widgets: user count, revenue chart, recent activity list"
   - "Admin panel" → "CRUD for users, roles, and settings. Audit log. No analytics."
   - "API" → "REST with /users, /auth, /products endpoints. JSON. Pagination."

5. **Domain-specific probes**
   | Domain | Key Questions |
   |---|---|
   | Visual/UI | Layout density? Mobile-first? Dark mode? Empty states? |
   | API/Backend | Response format? Rate limiting? Versioning? Auth method? |
   | Data | Schema flexibility? Migration strategy? Backup policy? |
   | Integration | Which external services? Fallback if down? Rate limits? |

6. **Capture, don't judge**
   - Record ALL ideas, even ones you think are bad
   - Categorize into: v1 must-have / v2 nice-to-have / out-of-scope
   - Let the user make the prioritization decision

7. **The "One Thing" test**
   - "If this project could only do ONE thing perfectly, what would it be?"
   - This becomes the core_value in project.json
   - Every other decision should serve this one thing

## Usage in Forge

### During /forge --init
Apply principles 1-7 to capture project vision. Use AskUserQuestion with concrete options at each step.

### During /forge --discuss N
Apply principles 1-5 to resolve gray areas in a specific phase. Focus on the phase's domain.

### During planning (when planner encounters ambiguity)
Apply principle 3 to choose between alternatives. Default to the simpler option unless user has expressed preference.

## Anti-Patterns
- Asking about technical experience ("Are you a beginner?")
- Open-ended questions that produce vague answers
- Assuming the user knows technical tradeoffs
- Listing 10+ options (max 4 per AskUserQuestion)
- Asking the same question twice in different words
