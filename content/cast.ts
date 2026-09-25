/**
 * The cast, as the dialogue names them (docs/PEDAGOGY.md §3).
 *
 * Content, not drawing: who each actor id is when they speak, and the
 * colour of the name tag on their speech bubble. The characters' bodies
 * are `src/ui/Characters.tsx` and `Crow.tsx`; this is only what the bubble
 * needs to say who is talking.
 *
 * The crow's name is a placeholder held in one constant, so renaming it is
 * one edit (§8). A lesson line may write `{CROW_NAME}` and `script` fills
 * it in.
 */

export const CROW_NAME = 'Corvid'

export type Speaker = {
  /** On the bubble's name tag. */
  name: string
  /** A colour token from `src/app/styles.css`, as its custom property
   *  name. The tag's text is white on it, so each is dark enough for
   *  small bold text (≥ 4.5:1). */
  colour: string
}

/** By actor id. The robot is here for completeness: it thinks, in a
 *  cloud, and has no speech bubble of its own (§3). */
export const SPEAKERS: Record<string, Speaker> = {
  crow: { name: CROW_NAME, colour: '--ink' },
  robot: { name: 'Robot', colour: '--brand-deep' },
  courier: { name: 'Mira', colour: '--mira' },
}

/** Who is speaking, for an actor id — the crow when there is none, and
 *  the id itself for an actor the cast list does not know. */
export const speakerOf = (id: string | undefined): Speaker =>
  SPEAKERS[id ?? 'crow'] ?? { name: id ?? CROW_NAME, colour: '--ink' }
