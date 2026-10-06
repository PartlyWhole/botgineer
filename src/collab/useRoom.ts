/**
 * A shared room, for a React page: share, join from the link, who is
 * here, leave.
 *
 * A link carrying a room (`#/code&room=…`, `router.roomInHash`) joins it on
 * load, and also when pasted into a tab already open, which changes only
 * the hash. Leaving takes the room off the link and drops it; the page
 * carries on solo with whatever the editor holds.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { hashWithoutRoom, roomInHash } from '../app/router'
import { BUILD, Room, transportsFrom, type LessonRoom, type Peer } from './room'

export type RoomStatus = 'solo' | 'connecting' | 'live' | 'unreachable'

export type RoomView = {
  status: RoomStatus
  room: Room | null
  peers: Peer[]
  /** Shares `code` (and a lesson, with what has happened in it) in a new
   *  room, and puts its link in the address bar. */
  share: (code: string, lesson?: LessonRoom) => Promise<void>
  leave: () => Promise<void>
  /** The whole link, for copying. */
  link: () => string | null
}

export function useRoom(): RoomView {
  const [status, setStatus] = useState<RoomStatus>('solo')
  const [room, setRoom] = useState<Room | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const roomRef = useRef<Room | null>(null)
  roomRef.current = room
  const joining = useRef<string | null>(null)

  const enter = useCallback((r: Room) => {
    roomRef.current = r
    setRoom(r)
    setStatus('live')
    // A test and debugging seam, like `window.botgineer`.
    ;(window as unknown as { __botgineerRoom?: Room }).__botgineerRoom = r
    ;(window as unknown as { __botgineerBuild?: string }).__botgineerBuild = BUILD
  }, [])

  // Join the room the link carries, now and whenever the hash changes to one.
  useEffect(() => {
    const check = () => {
      const want = roomInHash()
      const have = roomRef.current
      if (!want) return
      if (have) {
        // A different room while in one: start clean.
        if (have.url !== want.url) window.location.reload()
        return
      }
      if (joining.current === want.url) return
      joining.current = want.url
      setStatus('connecting')
      void Room.join(want.url, transportsFrom(window.location.search, want.via)).then((r) => {
        joining.current = null
        if (r) enter(r)
        else setStatus('unreachable')
      })
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [enter])

  // A room belongs to the page it was made on. Going elsewhere (the map,
  // another level) leaves it.
  useEffect(() => {
    if (!room) return
    const check = () => {
      if (!roomInHash()) void leaveRef.current()
    }
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [room])

  // Repaint on every change to the room or to who is in it.
  useEffect(() => (room ? room.subscribe(bump) : undefined), [room])

  // Closing the tab: say goodbye so the others drop this peer at once.
  useEffect(() => {
    if (!room) return
    const onHide = (e: PageTransitionEvent) => {
      if (!e.persisted) room.goodbye()
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [room])

  const share = useCallback(
    async (code: string, lesson?: LessonRoom) => {
      if (roomRef.current) return
      setStatus('connecting')
      try {
        const r = await Room.create(code, transportsFrom(window.location.search, null), lesson)
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}${r.link(hashWithoutRoom())}`)
        enter(r)
      } catch {
        setStatus('unreachable')
      }
    },
    [enter],
  )

  const leave = useCallback(async () => {
    const r = roomRef.current
    if (!r) return
    roomRef.current = null
    setRoom(null)
    setStatus('solo')
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hashWithoutRoom()}`)
    await r.leave()
  }, [])

  const leaveRef = useRef(leave)
  leaveRef.current = leave

  const link = useCallback(() => (roomRef.current ? window.location.href : null), [])

  return { status, room, peers: room ? room.peers() : [], share, leave, link }
}
