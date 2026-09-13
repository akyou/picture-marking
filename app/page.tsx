'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Circle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Eraser,
  FolderOpen,
  Hand,
  ImagePlus,
  Layers3,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Spline,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react'

type Point = { x: number; y: number }
type Item =
  | { id: string; kind: 'text'; x: number; y: number; text: string; size: number; color: string; weight: string; italic: boolean; underline: boolean; align: 'left' | 'center' | 'right'; lineHeight: number; letterSpacing: number; width: number; locked?: boolean; hidden?: boolean }
  | { id: string; kind: 'image'; x: number; y: number; width: number; height: number; src: string; name: string; aspectRatio: number; lockRatio: boolean; locked?: boolean; hidden?: boolean }
  | { id: string; kind: 'stroke'; points: Point[]; color: string; width: number; opacity: number; rotation?: number; locked?: boolean; hidden?: boolean }
  | { id: string; kind: 'stamp'; stamp: 'arrow' | 'circle' | 'check' | 'curve'; x: number; y: number; width: number; height: number; color: string; opacity: number; rotation: number; strokeWidth: number; arrowCurve?: number; arrowHeadSize?: number; arrowHeadAngle?: number; arrowTipInset?: number; arrowTailLength?: number; circleStyle?: 'plain' | 'ring3d'; circleTilt?: number; ringThickness?: number; ringGap?: number; locked?: boolean; hidden?: boolean }

const initialItems: Item[] = [
  { id: 'title', kind: 'text', x: 160, y: 120, text: '灵感画板', size: 42, color: '#17202a', weight: '700', italic: false, underline: false, align: 'left', lineHeight: 1.35, letterSpacing: 0, width: 520 },
  { id: 'note', kind: 'text', x: 164, y: 188, text: '把想法画出来', size: 20, color: '#718096', weight: '400', italic: false, underline: false, align: 'left', lineHeight: 1.5, letterSpacing: 0, width: 420 },
]

const colors = ['#ff6b4a', '#2778ff', '#23a582', '#f2b134', '#17202a']

function smoothPath(points: Point[]) {
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`
  }
  const last = points[points.length - 1]
  path += ` T ${last.x} ${last.y}`
  return path
}

function strokeBounds(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { centerX: (Math.min(...xs) + Math.max(...xs)) / 2, centerY: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

function circlePerspective(angleRatio = 0.62) {
  const clamped = Math.max(0, Math.min(1, angleRatio))
  return Math.max(0.06, Math.sin(clamped * Math.PI / 2))
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
}

function perspectiveRingPath(width: number, height: number, color: string, opacity: number) {
  const pitch = 45 * Math.PI / 180
  const radius = Math.min(width, height) / 2
  const outerRx = width / 2
  const outerRy = radius * Math.cos(pitch)
  const bandHeight = Math.max(4, Math.min(height * 0.22, 18))
  const innerRx = Math.max(1, outerRx - bandHeight)
  const innerRy = Math.max(1, outerRy - bandHeight * Math.cos(pitch))
  const cx = width / 2
  const cy = height / 2
  return { path: `${ellipsePath(cx, cy, outerRx, outerRy)} ${ellipsePath(cx, cy, innerRx, innerRy)}`, color, opacity }
}

function arrowGeometry(width: number, height: number, curve = 0, headSize = 38, headAngle = 28, tipInset = 20, tailLength = 100) {
  const baseStart = { x: 12, y: height - 24 }
  const tip = { x: width - tipInset, y: 24 }
  const tailFactor = Math.max(0.2, Math.min(1.8, tailLength / 100))
  const adjustedStart = { x: tip.x + (baseStart.x - tip.x) * tailFactor, y: tip.y + (baseStart.y - tip.y) * tailFactor }
  const dx = tip.x - adjustedStart.x
  const dy = tip.y - adjustedStart.y
  const length = Math.hypot(dx, dy) || 1
  const midpoint = { x: (adjustedStart.x + tip.x) / 2, y: (adjustedStart.y + tip.y) / 2 }
  const bend = (curve / 100) * Math.min(width, height) * 0.9
  const control = { x: midpoint.x - (dy / length) * bend, y: midpoint.y + (dx / length) * bend }
  const tangent = { x: tip.x - control.x, y: tip.y - control.y }
  const tangentLength = Math.hypot(tangent.x, tangent.y) || 1
  const ux = tangent.x / tangentLength
  const uy = tangent.y / tangentLength
  const angle = (headAngle * Math.PI) / 180
  const left = { x: tip.x - headSize * (ux * Math.cos(angle) - uy * Math.sin(angle)), y: tip.y - headSize * (uy * Math.cos(angle) + ux * Math.sin(angle)) }
  const right = { x: tip.x - headSize * (ux * Math.cos(angle) + uy * Math.sin(angle)), y: tip.y - headSize * (uy * Math.cos(angle) - ux * Math.sin(angle)) }
  return { shaft: `M ${adjustedStart.x} ${adjustedStart.y} Q ${control.x} ${control.y} ${tip.x} ${tip.y}`, head: `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}` }
}

function ToolbarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className={`toolbar-button ${active ? 'active' : ''}`}>{children}</button>
}

export default function Page() {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>('title')
  const [selectedIds, setSelectedIds] = useState<string[]>(['title'])
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null)
  const selectionStartRef = useRef<Point | null>(null)
  const [tool, setTool] = useState<'select' | 'pen' | 'text'>('select')
  const [color, setColor] = useState('#ff6b4a')
  const [penWidth, setPenWidth] = useState(8)
  const [opacity, setOpacity] = useState(85)
  const [zoom, setZoom] = useState(100)
  const [petOpen, setPetOpen] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const clearStaleDrag = () => {
      draggingRef.current = null
    }
    window.addEventListener('pointerup', clearStaleDrag)
    window.addEventListener('pointercancel', clearStaleDrag)
    return () => {
      window.removeEventListener('pointerup', clearStaleDrag)
      window.removeEventListener('pointercancel', clearStaleDrag)
    }
  }, [])
  const [history, setHistory] = useState<Item[][]>([])
  const [future, setFuture] = useState<Item[][]>([])
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drawingRef = useRef<{ points: Point[] } | null>(null)
  const draggingRef = useRef<{ id: string; start: Point; origin: Point; points?: Point[]; ids?: string[]; origins?: Record<string, Point>; strokePoints?: Record<string, Point[]>; resize?: { width: number; height: number; aspectRatio: number }; canvasRect?: DOMRect; zoom: number } | null>(null)
  const itemsRef = useRef(items)
  const moveFrameRef = useRef<number | null>(null)
  const pendingItemsRef = useRef<Item[] | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem('calm-flow-board')
    if (stored) {
      try { setItems(JSON.parse(stored)) } catch { /* ignore invalid local board */ }
    }
  }, [])

  useEffect(() => {
    itemsRef.current = items
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const persistentItems = items.filter((item) => item.id !== 'draft')
      try {
        window.localStorage.setItem('calm-flow-board', JSON.stringify(persistentItems))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('[v0] 画板内容超过浏览器存储容量，已跳过本次自动保存')
        }
      }
    }, 140)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [items])

  const scheduleItemsUpdate = (next: Item[]) => {
    // 立即更新引用，下一次 pointermove 不会继续基于上一帧位置计算
    itemsRef.current = next
    pendingItemsRef.current = next
    if (moveFrameRef.current !== null) return
    moveFrameRef.current = requestAnimationFrame(() => {
      if (pendingItemsRef.current) {
        setItems(pendingItemsRef.current)
        itemsRef.current = pendingItemsRef.current
        pendingItemsRef.current = null
      }
      moveFrameRef.current = null
    })
  }

  const commit = useCallback((next: Item[]) => {
    setHistory((prev) => [...prev.slice(-19), items])
    setFuture([])
    setItems(next)
  }, [items])

  const getPoint = (event: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect ? { x: (event.clientX - rect.left) * (100 / zoom), y: (event.clientY - rect.top) * (100 / zoom) } : { x: 0, y: 0 }
  }

  const onCanvasPointerDown = (event: React.PointerEvent) => {
    if (tool === 'pen') {
      event.currentTarget.setPointerCapture(event.pointerId)
      drawingRef.current = { points: [getPoint(event)] }
      return
    }
    if (tool === 'select') {
      // 只有点击画布空白处才启动框选；点击对象不会把已有选择带入框选
      if (event.target !== event.currentTarget) return
      const point = getPoint(event)
      if (!event.shiftKey) {
        setSelectedId(null)
        setSelectedIds([])
      }
      selectionStartRef.current = point
      setSelectionBox(null)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const onItemPointerDown = (event: React.PointerEvent, item: Item) => {
    if (tool !== 'select' || item.locked || item.hidden) {
      event.stopPropagation()
      return
    }
    event.stopPropagation()
    // 在实际命中的图层上捕获指针，保证标记可从透明区域持续自由拖动
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextIds = event.shiftKey
      ? (selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])
      : [item.id]
    setSelectedId(event.shiftKey && selectedIds.includes(item.id) ? (nextIds[0] ?? null) : item.id)
    setSelectedIds(nextIds)
    const point = getPoint(event)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    // 普通点击永远只拖动当前对象；只有 Shift 才携带已有多选对象
    const ids = event.shiftKey ? nextIds : [item.id]
    const origins = Object.fromEntries(items.filter((candidate) => ids.includes(candidate.id) && candidate.kind !== 'stroke').map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]))
    const strokePoints = Object.fromEntries(items.filter((candidate): candidate is Extract<Item, { kind: 'stroke' }> => ids.includes(candidate.id) && candidate.kind === 'stroke').map((candidate) => [candidate.id, candidate.points.map((strokePoint) => ({ ...strokePoint }))]))
    draggingRef.current = { id: item.id, start: point, origin: item.kind === 'stroke' ? { x: 0, y: 0 } : { x: item.x, y: item.y }, ids, origins, strokePoints, points: item.kind === 'stroke' ? item.points.map((strokePoint) => ({ ...strokePoint })) : undefined, canvasRect, zoom }
  }

  const onStampResizePointerDown = (event: React.PointerEvent, item: Extract<Item, { kind: 'stamp' }>) => {
    if (item.locked) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    draggingRef.current = { id: item.id, start: getPoint(event), origin: { x: item.x, y: item.y }, ids: [item.id], origins: { [item.id]: { x: item.x, y: item.y } }, resize: { width: item.width, height: item.height, aspectRatio: item.width / item.height }, canvasRect, zoom }
  }

  const onCanvasPointerMove = (event: React.PointerEvent) => {
    const drawing = drawingRef.current
    if (drawing) {
      drawing.points.push(getPoint(event))
      const points = [...drawing.points]
      setItems((prev) => [...prev.filter((item) => item.id !== 'draft'), { id: 'draft', kind: 'stroke', points, color, width: penWidth, opacity: opacity / 100, rotation: 0 }])
      return
    }
    const dragging = draggingRef.current
    if (dragging) {
      const point = dragging.canvasRect ? { x: (event.clientX - dragging.canvasRect.left) * (100 / dragging.zoom), y: (event.clientY - dragging.canvasRect.top) * (100 / dragging.zoom) } : getPoint(event)
      const dx = point.x - dragging.start.x
      const dy = point.y - dragging.start.y
      scheduleItemsUpdate(itemsRef.current.map((item) => {
        if (!dragging.ids?.includes(item.id)) return item
        if (dragging.resize && item.kind === 'stamp') {
          const width = Math.max(40, dragging.resize.width + dx)
          const height = Math.max(40, dragging.resize.height + dy)
          return { ...item, width, height }
        }
        if (item.kind === 'stroke') {
          const points = dragging.strokePoints?.[item.id] ?? dragging.points
          if (!points) return item
          return { ...item, points: points.map((strokePoint) => ({ x: strokePoint.x + dx, y: strokePoint.y + dy })) }
        }
        const origin = dragging.origins?.[item.id] ?? dragging.origin
        return { ...item, x: origin.x + dx, y: origin.y + dy } as Item
      }))
      return
    }
    if (selectionStartRef.current) {
      const point = getPoint(event)
      const start = selectionStartRef.current
      const moved = Math.hypot(point.x - start.x, point.y - start.y)
      if (moved >= 6) setSelectionBox({ start, end: point })
      return
    }
  }

  const onCanvasPointerUp = () => {
    if (!selectionBox) {
      selectionStartRef.current = null
      return
    }
    if (selectionBox) {
      const left = Math.min(selectionBox.start.x, selectionBox.end.x)
      const right = Math.max(selectionBox.start.x, selectionBox.end.x)
      const top = Math.min(selectionBox.start.y, selectionBox.end.y)
      const bottom = Math.max(selectionBox.start.y, selectionBox.end.y)
      const ids = items.filter((item) => {
        // 锁定或隐藏图层完全不参与框选，只有从图层面板解锁后才能重新选中
        if (item.locked || item.hidden) return false
        if (item.kind === 'stroke') {
          const xs = item.points.map((point) => point.x)
          const ys = item.points.map((point) => point.y)
          return Math.max(...xs) >= left && Math.min(...xs) <= right && Math.max(...ys) >= top && Math.min(...ys) <= bottom
        }
        return item.x <= right && item.x + (item.kind === 'text' ? item.width : item.width) >= left && item.y <= bottom && item.y + (item.kind === 'text' ? item.size * item.lineHeight : item.height) >= top
      }).map((item) => item.id)
      setSelectedIds(ids)
      setSelectedId(ids[0] ?? null)
      setSelectionBox(null)
      selectionStartRef.current = null
    }
    if (drawingRef.current) {
      const points = drawingRef.current.points
      drawingRef.current = null
      if (points.length > 1) commit([...items.filter((item) => item.id !== 'draft'), { id: crypto.randomUUID(), kind: 'stroke', points, color, width: penWidth, opacity: opacity / 100, rotation: 0 }])
      return
    }
    draggingRef.current = null
  }
  const addStamp = (stamp: Extract<Item, { kind: 'stamp' }>['stamp']) => {
    const item: Extract<Item, { kind: 'stamp' }> = { id: crypto.randomUUID(), kind: 'stamp', stamp, x: 340, y: 300, width: stamp === 'circle' ? 150 : 190, height: stamp === 'circle' ? 110 : 150, color, opacity: opacity / 100, rotation: 0, strokeWidth: 8, arrowCurve: 0, arrowHeadSize: 38, arrowHeadAngle: 28, arrowTipInset: 20, arrowTailLength: 100, circleStyle: 'plain', circleTilt: 0.62, ringThickness: 14, ringGap: 7 }
    commit([...items, item])
    setSelectedId(item.id)
    setSelectedIds([item.id])
    setTool('select')
  }

  const addText = () => {
    const item: Item = { id: crypto.randomUUID(), kind: 'text', x: 260, y: 280, text: '双击编辑文字', size: 24, color, weight: '500', italic: false, underline: false, align: 'left', lineHeight: 1.45, letterSpacing: 0, width: 360 }
    commit([...items, item]); setSelectedId(item.id); setTool('select')
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      const image = new Image()
      image.onload = () => {
        const item: Item = { id: crypto.randomUUID(), kind: 'image', x: 280, y: 270, width: image.naturalWidth, height: image.naturalHeight, src, name: file.name, aspectRatio: image.naturalWidth / image.naturalHeight, lockRatio: true }
        commit([...items, item]); setSelectedId(item.id); setTool('select')
      }
      image.src = src
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (!file) return
      event.preventDefault()
      readFile(new File([file], file.name || `粘贴图片-${Date.now()}.png`, { type: file.type }))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [items])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && (selectedId || selectedIds.length)) {
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, selectedIds, items])

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture((prev) => [items, ...prev]); setItems(previous); setHistory((prev) => prev.slice(0, -1))
  }
  const redo = () => {
    const next = future[0]
    if (!next) return
    setHistory((prev) => [...prev, items]); setItems(next); setFuture((prev) => prev.slice(1))
  }
  const deleteSelected = () => {
    const ids = selectedIds.length ? new Set(selectedIds) : selectedId ? new Set([selectedId]) : new Set<string>()
    if (!ids.size) return
    commit(items.filter((item) => !ids.has(item.id)))
    setSelectedId(null)
    setSelectedIds([])
    setContextMenu(null)
  }
  const moveLayer = (direction: 'front' | 'back') => {
    if (!selectedId) return
    const index = items.findIndex((item) => item.id === selectedId)
    if (index < 0) return
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (direction === 'front') next.push(item)
    else next.unshift(item)
    commit(next)
    setContextMenu(null)
  }
  const toggleSelectedLock = () => {
    if (!selectedId) return
    setItems((prev) => prev.map((item) => item.id === selectedId ? { ...item, locked: !item.locked } as Item : item))
  }
  const toggleItemVisibility = (id: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, hidden: !item.hidden } as Item : item))
    if (selectedId === id) {
      setSelectedId(null)
      setSelectedIds((prev) => prev.filter((selected) => selected !== id))
    }
  }
  const selectLayer = (item: Item) => {
    if (item.hidden) return
    setSelectedId(item.id)
    setSelectedIds([item.id])
  }
  const handleItemContextMenu = (event: React.MouseEvent, item: Item) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(item.id)
    setSelectedIds([item.id])
    setContextMenu({ x: event.clientX, y: event.clientY })
  }
  const selected = items.find((item) => item.id === selectedId)
  const updateSelected = (patch: Partial<Item>) => { if (!selectedId) return; setItems((prev) => prev.map((item) => item.id === selectedId ? ({ ...item, ...patch } as Item) : item)) }

  const exportBoard = () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 760
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    items.forEach((item) => {
      if (item.kind === 'text') { ctx.fillStyle = item.color; ctx.font = `${item.italic ? 'italic ' : ''}${item.weight} ${item.size}px sans-serif`; ctx.textAlign = item.align; item.text.split('\\n').forEach((line, index) => ctx.fillText(line, item.x, item.y + index * item.size * item.lineHeight)); ctx.textAlign = 'left' }
      if (item.kind === 'image') { const image = new Image(); image.onload = () => ctx.drawImage(image, item.x, item.y, item.width, item.height); image.src = item.src }
      if (item.kind === 'stroke') { ctx.strokeStyle = item.color; ctx.globalAlpha = item.opacity; ctx.lineWidth = item.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); item.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.globalAlpha = 1 }
      if (item.kind === 'stamp') { ctx.save(); ctx.translate(item.x + item.width / 2, item.y + item.height / 2); ctx.rotate(item.rotation * Math.PI / 180); ctx.strokeStyle = item.color; ctx.globalAlpha = item.opacity; ctx.lineWidth = item.strokeWidth ?? 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); if (item.stamp === 'circle') { if (item.circleStyle === 'ring3d') { const pitch = (item.circleTilt ?? 0.62) * Math.PI / 2; const R = item.width / 2; const ry = R * Math.cos(pitch); const d = (item.height / 2) * Math.sin(pitch); const FILL = `rgba(59, 130, 246, ${item.opacity})`; ctx.fillStyle = FILL; ctx.beginPath(); ctx.ellipse(0, -d, R, ry, 0, 0, Math.PI * 2); ctx.ellipse(0, d, R, ry, 0, 0, Math.PI * 2); ctx.fill('evenodd'); ctx.beginPath(); ctx.ellipse(0, -d, R, ry, 0, Math.PI, 0, true); ctx.lineTo(R, d); ctx.ellipse(0, d, R, ry, 0, 0, Math.PI, false); ctx.closePath(); ctx.fill(); } else { ctx.beginPath(); ctx.ellipse(0, 0, item.width / 2, item.height / 2, 0, 0, Math.PI * 2); ctx.stroke(); } } if (item.stamp === 'arrow') { const geo = arrowGeometry(item.width, item.height, item.arrowCurve ?? 0, item.arrowHeadSize ?? 38, item.arrowHeadAngle ?? 28, item.arrowTipInset ?? 20, item.arrowTailLength ?? 100); const path = new Path2D(geo.shaft); ctx.stroke(path); ctx.beginPath(); const headNumbers = geo.head.match(/-?[\d.]+/g)?.map(Number) ?? []; ctx.moveTo(headNumbers[0], headNumbers[1]); ctx.lineTo(headNumbers[2], headNumbers[3]); ctx.lineTo(headNumbers[4], headNumbers[5]) } if (item.stamp === 'check') { ctx.moveTo(-item.width / 2, 0); ctx.quadraticCurveTo(-item.width / 4, item.height / 2, 0, item.height / 4); ctx.quadraticCurveTo(item.width / 4, -item.height / 4, item.width / 2, -item.height / 2) } if (item.stamp === 'curve') { ctx.moveTo(-item.width / 2, -item.height / 3); ctx.quadraticCurveTo(-item.width / 4, item.height / 2, 0, item.height / 3); ctx.quadraticCurveTo(item.width / 4, 0, item.width / 2, -item.height / 2) } ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1 }
    })
    const link = document.createElement('a'); link.download = '灵感画板.png'; link.href = canvas.toDataURL(); link.click()
  }

  return (
    <main className="app-shell" onClick={() => contextMenu && setContextMenu(null)}>
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>Calm Flow</strong><span>灵感画板</span></div></div>
        <div className="top-actions"><button className="icon-ghost" aria-label="帮助"><CircleHelp size={18} /></button><button className="avatar">林</button></div>
      </header>
      <div className="workspace">
        <aside className="left-rail">
          <div className="rail-section"><p className="eyebrow">工具</p><ToolbarButton label="选择" active={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={19} /></ToolbarButton><ToolbarButton label="手型" onClick={() => setTool('select')}><Hand size={19} /></ToolbarButton><ToolbarButton label="画笔" active={tool === 'pen'} onClick={() => setTool('pen')}><Pencil size={19} /></ToolbarButton><ToolbarButton label="文字" active={tool === 'text'} onClick={addText}><Type size={19} /></ToolbarButton><ToolbarButton label="图片" onClick={() => fileRef.current?.click()}><ImagePlus size={19} /></ToolbarButton></div>
          <div className="rail-divider" />
          <div className="rail-section"><p className="eyebrow">视图</p><ToolbarButton label="图层"><Layers3 size={19} /></ToolbarButton><ToolbarButton label="设置"><Settings2 size={19} /></ToolbarButton></div>
        </aside>
        <section className="editor-area">
          <div className="editor-toolbar"><div className="tool-group"><button className="select-button"><MousePointer2 size={15} /> 选择 <ChevronDown size={14} /></button><span className="separator" /><button className="round-tool" onClick={undo} aria-label="撤销"><Undo2 size={17} /></button><div className="stamp-palette top-stamp-palette" aria-label="Apple 风格矢量标记"><span className="eyebrow">标记</span><button type="button" title="箭头" aria-label="插入箭头" onClick={() => addStamp('arrow')}><ArrowUpRight size={18} strokeWidth={2.2} /></button><button type="button" title="圆圈" aria-label="插入圆圈" onClick={() => addStamp('circle')}><Circle size={18} strokeWidth={2.2} /></button><button type="button" title="勾画" aria-label="插入勾画" onClick={() => addStamp('check')}><Check size={19} strokeWidth={2.4} /></button><button type="button" title="直箭头" aria-label="插入直箭头" onClick={() => addStamp('arrow')}><ArrowUpRight size={18} strokeWidth={2.2} /></button></div><button className="round-tool" onClick={redo} aria-label="重做"><Redo2 size={17} /></button></div><div className="tool-group"><button className="zoom-button" onClick={() => setZoom(Math.max(50, zoom - 10))}><Minus size={14} /></button><span className="zoom-value">{zoom}%</span><button className="zoom-button" onClick={() => setZoom(Math.min(150, zoom + 10))}><Plus size={14} /></button><span className="separator" /><button className="export-button" onClick={exportBoard}><ArrowDownToLine size={15} /> 导出</button></div></div>
          <div className="canvas-wrap"><div ref={canvasRef} className="board-canvas" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerCancel={onCanvasPointerUp} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }) }}>
            <div className="canvas-grid" />
            {selectionBox && <div className="selection-box" style={{ left: Math.min(selectionBox.start.x, selectionBox.end.x), top: Math.min(selectionBox.start.y, selectionBox.end.y), width: Math.abs(selectionBox.end.x - selectionBox.start.x), height: Math.abs(selectionBox.end.y - selectionBox.start.y) }} />}
            {items.map((item) => item.hidden ? null : item.kind === 'stroke' ? <svg key={item.id} className={`stroke-layer ${selectedIds.includes(item.id) ? 'selected' : ''}`} style={{ left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><g transform={`rotate(${item.rotation ?? 0} ${strokeBounds(item.points).centerX} ${strokeBounds(item.points).centerY})`}><path d={smoothPath(item.points)} fill="none" stroke={item.color} strokeWidth={item.width} strokeOpacity={item.opacity} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none' }} onPointerDown={(event) => onItemPointerDown(event, item)} onContextMenu={(event) => handleItemContextMenu(event, item)} /></g></svg> : item.kind === 'stamp' ? <svg key={item.id} className={`stamp-layer ${selectedIds.includes(item.id) ? 'selected' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height, overflow: 'visible', pointerEvents: tool === 'select' && !item.locked ? 'auto' : 'none', touchAction: 'none', transform: `rotate(${item.rotation}deg)`, transformOrigin: 'center' }} onPointerDown={(event) => onItemPointerDown(event, item)} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerCancel={onCanvasPointerUp} onContextMenu={(event) => handleItemContextMenu(event, item)}><rect width="100%" height="100%" fill="transparent" pointerEvents="all" onPointerDown={(event) => onItemPointerDown(event, item)} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} />{item.stamp === 'circle' && item.circleStyle === 'ring3d' && (() => { const ring = perspectiveRingPath(item.width, item.height, item.color, item.opacity); return <g fill={ring.color} fillOpacity={ring.opacity} stroke="none"><path d={ring.path} fill={ring.color} fillOpacity={ring.opacity} fillRule="evenodd" clipRule="evenodd" /></g> })()}<g opacity={item.circleStyle === 'ring3d' ? 0 : 1} fill="none" stroke={item.color} strokeOpacity={item.opacity} strokeWidth={item.circleStyle === 'ring3d' ? (item.ringThickness ?? 14) : (item.strokeWidth ?? 8)} strokeLinecap="round" strokeLinejoin="round">{item.stamp === 'circle' && <>{item.circleStyle === 'ring3d' ? <g transform={`scale(1 ${circlePerspective(item.circleTilt ?? 0.62)})`} fill="none" transform={`rotate(-8 ${item.width / 2} ${item.height / 2})`}><ellipse cx={item.width / 2 + 5} cy={item.height / 2 + 7} rx={item.width / 2 - 10} ry={(item.height / 2 - 10) * (circlePerspective(item.circleTilt ?? 0.62))} fill={item.color} fillOpacity={item.opacity * 0.22} stroke="none" /><ellipse cx={item.width / 2} cy={item.height / 2} rx={item.width / 2 - 10} ry={(item.height / 2 - 10) * (circlePerspective(item.circleTilt ?? 0.62))} fill="none" stroke={item.color} strokeOpacity={item.opacity * 0.35} strokeWidth={(item.ringThickness ?? 14) + 5} strokeDasharray={`calc(100% - ${item.ringGap ?? 7}px) ${item.ringGap ?? 7}px`} /><ellipse cx={item.width / 2} cy={item.height / 2} rx={item.width / 2 - 10} ry={(item.height / 2 - 10) * (circlePerspective(item.circleTilt ?? 0.62))} fill="none" stroke={item.color} strokeOpacity={item.opacity} strokeWidth={item.ringThickness ?? 14} strokeDasharray={`calc(100% - ${item.ringGap ?? 7}px) ${item.ringGap ?? 7}px`} /><path d={`M ${item.width * 0.72} ${item.height * (0.5 - (circlePerspective(item.circleTilt ?? 0.62)) * 0.32)} l ${item.ringThickness ?? 14} ${item.ringThickness ?? 14} M ${item.width * 0.72 + 18} ${item.height * (0.5 - (circlePerspective(item.circleTilt ?? 0.62)) * 0.32) - 2} l ${item.ringThickness ?? 10} ${item.ringThickness ?? 10}`} stroke={item.color} strokeOpacity={item.opacity * 0.65} strokeWidth={item.ringThickness ?? 10} /></g> : <>{item.circleStyle === 'overlay' && <><ellipse cx={item.width / 2 - 2} cy={item.height / 2 + 1} rx={item.width / 2 - 8} ry={item.height / 2 - 8} strokeOpacity={item.opacity * 0.28} /><ellipse cx={item.width / 2 + 2} cy={item.height / 2 - 1} rx={item.width / 2 - 8} ry={item.height / 2 - 8} strokeOpacity={item.opacity * 0.22} /></>}<ellipse cx={item.width / 2} cy={item.height / 2} rx={item.width / 2 - 8} ry={item.height / 2 - 8} /></>}</>}{item.stamp === 'arrow' && <><path d={arrowGeometry(item.width, item.height, item.arrowCurve ?? 0, item.arrowHeadSize ?? 38, item.arrowHeadAngle ?? 28, item.arrowTipInset ?? 20, item.arrowTailLength ?? 100).shaft} /><path d={arrowGeometry(item.width, item.height, item.arrowCurve ?? 0, item.arrowHeadSize ?? 38, item.arrowHeadAngle ?? 28, item.arrowTipInset ?? 20, item.arrowTailLength ?? 100).head} strokeLinejoin="miter" /></>}{item.stamp === 'check' && <path d={`M 18 ${item.height * 0.48} C ${item.width * 0.18} ${item.height * 0.72}, ${item.width * 0.27} ${item.height * 0.9}, ${item.width * 0.42} ${item.height * 0.78} C ${item.width * 0.62} ${item.height * 0.62}, ${item.width * 0.76} ${item.height * (0.5 - (item.checkCurve ?? 50) / 500)}, ${item.width - 14} 16`} />}{item.stamp === 'curve' && <path d={`M 18 20 Q ${item.width / 3} ${item.height - 8} ${item.width / 2} ${item.height / 2} Q ${item.width * 0.72} ${item.height / 3} ${item.width - 14} 16`} />}</g>{selectedIds.includes(item.id) && <circle cx={item.width - 8} cy={item.height - 8} r="7" fill="var(--accent)" stroke="white" strokeWidth="2" style={{ cursor: 'nwse-resize' }} onPointerDown={(event) => onStampResizePointerDown(event, item)} />}</svg> : item.kind === 'image' ? <div key={item.id} className={`board-image ${selectedIds.includes(item.id) ? 'selected' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height }} onPointerDown={(e) => onItemPointerDown(e, item)} onContextMenu={(e) => handleItemContextMenu(e, item)} onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }}><img src={item.src} alt={item.name} /><span className="resize-handle" /></div> : <div key={item.id} className={`board-text ${selectedIds.includes(item.id) ? 'selected' : ''}`} style={{ left: item.x, top: item.y, width: item.width, color: item.color, fontSize: item.size, letterSpacing: item.letterSpacing, fontWeight: item.weight, fontStyle: item.italic ? 'italic' : 'normal', textDecoration: item.underline ? 'underline' : 'none', textAlign: item.align, lineHeight: item.lineHeight, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} onPointerDown={(e) => onItemPointerDown(e, item)} onContextMenu={(e) => handleItemContextMenu(e, item)} onClick={(e) => { e.stopPropagation(); setSelectedId(item.id) }} onDoubleClick={() => { const text = window.prompt('编辑文字', item.text); if (text) updateSelected({ text }) }}>{item.text}</div>)}
            <div className="canvas-caption"><span className="caption-dot" /> 新建画布 <span className="caption-muted">· 自动保存</span></div>{selected?.kind === 'stroke' && <div className="stroke-controls" onPointerDown={(event) => event.stopPropagation()}><strong>矢量标记</strong><label>颜色<input type="color" value={selected.color} onChange={(event) => updateSelected({ color: event.target.value })} /></label><label>粗细<input type="range" min="1" max="40" value={selected.width} onChange={(event) => updateSelected({ width: Number(event.target.value) })} /></label><label>透明度<input type="range" min="0" max="100" value={Math.round(selected.opacity * 100)} onChange={(event) => updateSelected({ opacity: Number(event.target.value) / 100 })} /></label><label className="range-field">旋转 <output>{selected.rotation ?? 0}°</output><input type="range" min="-180" max="180" step="1" value={selected.rotation ?? 0} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /></label><button type="button" onClick={() => updateSelected({ rotation: 0 })}>重置角度</button></div>}{selected?.kind === 'stamp' && selected.stamp === 'circle' && <div className="stroke-controls" onPointerDown={(event) => event.stopPropagation()}><strong>圆圈样式</strong><div className="style-toggle-row"><span>立体透视圆环</span><button type="button" role="switch" aria-checked={selected.circleStyle === 'ring3d'} className={`switch-control ${selected.circleStyle === 'ring3d' ? 'active' : ''}`} onClick={() => updateSelected({ circleStyle: selected.circleStyle === 'ring3d' ? 'plain' : 'ring3d' })}><span /></button></div></div>}{selected?.kind === 'stamp' && selected.stamp === 'arrow' && <div className="stroke-controls" onPointerDown={(event) => event.stopPropagation()}><strong>箭头样式</strong><label className="range-field">箭身弧度 <output>{selected.arrowCurve ?? 0}</output><input type="range" min="-100" max="100" value={selected.arrowCurve ?? 0} onChange={(event) => updateSelected({ arrowCurve: Number(event.target.value) })} /></label><label className="range-field">箭头大小 <output>{selected.arrowHeadSize ?? 38}px</output><input type="range" min="12" max="90" value={selected.arrowHeadSize ?? 38} onChange={(event) => updateSelected({ arrowHeadSize: Number(event.target.value) })} /></label><label className="range-field">箭头张角 <output>{selected.arrowHeadAngle ?? 28}°</output><input type="range" min="8" max="55" value={selected.arrowHeadAngle ?? 28} onChange={(event) => updateSelected({ arrowHeadAngle: Number(event.target.value) })} /></label><label className="range-field">箭头端距 <output>{selected.arrowTipInset ?? 20}px</output><input type="range" min="0" max="80" value={selected.arrowTipInset ?? 20} onChange={(event) => updateSelected({ arrowTipInset: Number(event.target.value) })} /></label><label className="range-field">箭尾长度 <output>{selected.arrowTailLength ?? 100}%</output><input type="range" min="20" max="180" value={selected.arrowTailLength ?? 100} onChange={(event) => updateSelected({ arrowTailLength: Number(event.target.value) })} /></label></div>}
          </div></div>
        </section>
        <aside className="properties-panel"><div className="panel-heading"><div><p className="eyebrow">检查器</p><h2>{selected ? selected.kind === 'text' ? '文字属性' : selected.kind === 'image' ? '图片属性' : selected.kind === 'stamp' ? '矢量标记属性' : '画笔属性' : '未选择对象'}</h2></div>{selected && <button className={`icon-ghost ${selected.locked ? 'active' : ''}`} onClick={toggleSelectedLock} aria-label={selected.locked ? '解锁图层' : '锁定图层'} title={selected.locked ? '解锁图层' : '锁定图层'}><Settings2 size={16} /></button>}<button className="icon-ghost"><MoreHorizontal size={18} /></button></div>{selected ? <div className="property-content">{selected.kind === 'image' && <><div className="property-row"><label>宽度<input type="number" min="1" value={selected.width} onChange={(e) => { const width = Math.max(1, Number(e.target.value)); updateSelected({ width, height: selected.lockRatio ? Math.round(width / (selected.aspectRatio || selected.width / selected.height)) : selected.height }) }} /></label><label>高度<input type="number" min="1" value={selected.height} onChange={(e) => { const height = Math.max(1, Number(e.target.value)); updateSelected({ height, width: selected.lockRatio ? Math.round(height * selected.aspectRatio) : selected.width }) }} /></label></div><label className="range-field">图片大小 <output>{Math.round(selected.width)} px</output><input type="range" min="40" max="1200" value={Math.min(1200, Math.max(40, Math.round(selected.width)))} onChange={(e) => { const width = Number(e.target.value); updateSelected({ width, height: selected.lockRatio ? Math.max(1, Math.round(width / (selected.aspectRatio || selected.width / selected.height))) : selected.height }) }} /></label><button type="button" className={`style-toggles ${selected.lockRatio ? 'active' : ''}`} onClick={() => updateSelected({ lockRatio: !selected.lockRatio })}>锁定等比例缩放</button><p className="property-hint">可拖动滑块快速放大或缩小，锁定比例后会同步高度</p></>}{selected.kind === 'stamp' && <><div className="property-row"><label>宽度<input type="number" min="40" value={selected.width} onChange={(e) => updateSelected({ width: Math.max(40, Number(e.target.value) || 40) })} /></label><label>高度<input type="number" min="40" value={selected.height} onChange={(e) => updateSelected({ height: Math.max(40, Number(e.target.value) || 40) })} /></label></div><div className="position-controls"><label className="range-field">水平位置 <output>{Math.round(selected.x)} px</output><input type="range" min="0" max={Math.max(0, 1200 - selected.width)} value={Math.round(selected.x)} onChange={(e) => updateSelected({ x: Number(e.target.value) })} /></label><label className="range-field">垂直位置 <output>{Math.round(selected.y)} px</output><input type="range" min="0" max={Math.max(0, 760 - selected.height)} value={Math.round(selected.y)} onChange={(e) => updateSelected({ y: Number(e.target.value) })} /></label></div><label>颜色<input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} /></label><label>粗细<input type="range" min="1" max="40" value={selected.strokeWidth ?? 8} onChange={(e) => updateSelected({ strokeWidth: Number(e.target.value) })} /></label><label>透明度<input type="range" min="0" max="100" value={Math.round(selected.opacity * 100)} onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })} /></label><label>旋转角度<input type="range" min="-180" max="180" step="1" value={selected.rotation} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /><output>{selected.rotation}°</output></label><button type="button" className="style-toggles" onClick={() => updateSelected({ rotation: 0 })}>重置旋转</button></>}{selected.kind === 'text' && <><label>内容<textarea rows={4} value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} placeholder="输入文字，支持换行" /></label><div className="property-row"><label>字体间距<input type="number" min="-5" max="30" step="0.5" value={selected.letterSpacing} onChange={(e) => updateSelected({ letterSpacing: Number(e.target.value) || 0 })} /></label><label>文字区域宽度<input type="number" min="40" max="900" step="10" value={selected.width} onChange={(e) => updateSelected({ width: Math.max(40, Number(e.target.value) || 40) })} /></label></div><div className="property-row"><label>字重<select value={selected.weight} onChange={(e) => updateSelected({ weight: e.target.value })}><option value="400">常规</option><option value="500">中等</option><option value="600">半粗</option><option value="700">粗体</option></select></label><label>对齐<select value={selected.align} onChange={(e) => updateSelected({ align: e.target.value as 'left' | 'center' | 'right' })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label></div><div className="property-row"><label>行高<input type="number" min="1" max="3" step="0.05" value={selected.lineHeight} onChange={(e) => updateSelected({ lineHeight: Number(e.target.value) })} /></label><label>宽度<input type="number" min="80" max="900" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></label></div><div className="style-toggles"><button type="button" className={selected.italic ? 'active' : ''} onClick={() => updateSelected({ italic: !selected.italic })}><em>I</em> 斜体</button><button type="button" className={selected.underline ? 'active' : ''} onClick={() => updateSelected({ underline: !selected.underline })}><u>U</u> 下划线</button></div><div className="property-row"><label>字号<input type="number" value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) })} /></label><label>对齐<button className="mini-select"><AlignCenter size={15} /> 居中</button></label></div><label>颜色<div className="color-row">{colors.map((c) => <button key={c} className={`color-swatch ${selected.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => updateSelected({ color: c })} />)}<input className="hex-input" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} /></div></label></>}{selected.kind === 'stroke' && <><label>笔触颜色<div className="color-row">{colors.map((c) => <button key={c} className={`color-swatch ${selected.color === c ? 'chosen' : ''}`} style={{ backgroundColor: c }} onClick={() => updateSelected({ color: c })} />)}</div></label><label>粗细<div className="range-row"><input type="range" min="2" max="32" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /><span>{selected.width}px</span></div></label><label>透明度<div className="range-row"><input type="range" min="10" max="100" value={selected.opacity * 100} onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })} /><span>{Math.round(selected.opacity * 100)}%</span></div></label></>}{selected.kind === 'image' && <><label>文件名<input value={selected.name} readOnly /></label><div className="property-row"><label>宽度<input type="number" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></label><label>高度<input type="number" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></label></div></>}<div className="panel-actions"><button onClick={deleteSelected} className="danger-button"><Trash2 size={15} /> 删除对象</button><button className="secondary-button" onClick={() => { const copyItem = { ...selected, id: crypto.randomUUID(), x: selected.x + 24, y: selected.y + 24 } as Item; commit([...items, copyItem]); setSelectedId(copyItem.id) }}><Copy size={15} /> 复制</button></div></div> : <div className="empty-inspector"><MousePointer2 size={22} /><p>选择画布中的对象<br />查看和编辑属性</p></div>}<div className="layers-list"><div className="layers-title"><span>图层</span><span className="layer-count">{items.length}</span></div>{items.slice().reverse().map((item) => <button key={item.id} className={`layer-item ${selectedIds.includes(item.id) ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>{item.kind === 'text' ? <Type size={14} /> : item.kind === 'image' ? <ImagePlus size={14} /> : <Pencil size={14} />}<span>{item.kind === 'text' ? item.text : item.kind === 'image' ? item.name : '平滑笔触'}</span></button>)}</div><div className="layers-panel"><div className="layers-heading"><div><p className="eyebrow">图层</p><strong>{items.length} 个对象</strong></div></div><div className="layers-list">{[...items].reverse().map((item) => { const label = item.kind === 'text' ? (item.text.split('\n')[0] || '文字') : item.kind === 'image' ? item.name : item.kind === 'stamp' ? ({ arrow: '箭头', circle: '圆圈', check: '勾画', curve: '曲线' }[item.stamp]) : '自由画笔'; return <div key={item.id} className={`layer-row ${selectedIds.includes(item.id) ? 'selected' : ''} ${item.hidden ? 'hidden' : ''}`}><button className="layer-main" type="button" onClick={() => selectLayer(item)} disabled={item.hidden}><span className="layer-kind">{item.kind === 'text' ? <Type size={14} /> : item.kind === 'image' ? <ImagePlus size={14} /> : item.kind === 'stamp' ? <ArrowUpRight size={14} /> : <Pencil size={14} />}</span><span className="layer-name">{label}</span></button><button className="layer-action" type="button" onClick={() => toggleItemVisibility(item.id)} aria-label={item.hidden ? `显示${label}` : `隐藏${label}`} title={item.hidden ? '显示图层' : '隐藏图层'}>{item.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button><button className={`layer-action ${item.locked ? 'active' : ''}`} type="button" onClick={() => { setSelectedId(item.id); setSelectedIds([item.id]); setItems((prev) => prev.map((candidate) => candidate.id === item.id ? { ...candidate, locked: !candidate.locked } as Item : candidate)) }} aria-label={item.locked ? `解锁${label}` : `锁定${label}`} title={item.locked ? '解锁图层' : '锁定图层'}>{item.locked ? <Lock size={15} /> : <Unlock size={15} />}</button></div>})}</div></div></aside>
      </div>
      {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}><button onClick={() => { setTool('pen'); setContextMenu(null) }}><Pencil size={15} /> 在此绘制</button><button onClick={() => { setTool('select'); setContextMenu(null) }}><Settings2 size={15} /> 调整属性</button><button onClick={() => moveLayer('front')}><ArrowDownToLine size={15} /> 置于顶层</button><button onClick={() => moveLayer('back')}><ArrowDownToLine size={15} className="rotate-180" /> 置于底层</button><button onClick={toggleSelectedLock}><Settings2 size={15} /> {selected?.locked ? '解锁图层' : '锁定图层'}</button><div className="context-line" /><button onClick={deleteSelected}><Trash2 size={15} /> 删除</button></div>}
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
      <div className={`pet-widget ${petOpen ? 'pet-open' : ''}`}><button className="pet-close" onClick={() => setPetOpen(false)} aria-label="收起小宠物"><X size={13} /></button><button className="pet-body" onDoubleClick={() => setPetOpen(true)} title="双击打开画板"><div className="pet-face"><span /><span /></div><div className="pet-ear left" /><div className="pet-ear right" /></button>{petOpen && <div className="pet-bubble">双击我打开画板</div>}</div>
    </main>
  )
}
