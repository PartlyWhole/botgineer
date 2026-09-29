/**
 * The crow's mark on something the crow is showing rather than the robot
 * doing: a feather and the crow's name, the way the speech bubble's name
 * tag says who is talking. Worn by the console's demonstration line and
 * by memory while it shows the crow's demonstration (`MemoryPanel`), so
 * the two read as one thing. Decoration: each wearer says in words, for
 * a screen reader, whose example it is.
 */
import { CROW_NAME } from '../../content/cast'

export function FeatherMark() {
  return (
    <svg className="mark feather-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M14 2C8 2 4 6 3.5 12.5L2 14" />
      <path d="M14 2c0 5-3.5 9-10 10.2M7 7.5l3.2.3M5.3 10l3.4.1" />
    </svg>
  )
}

export function DemoTag() {
  return (
    <span className="demo-tag" aria-hidden="true">
      <FeatherMark />
      {CROW_NAME}
    </span>
  )
}
