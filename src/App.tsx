import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

type NoteItem = {
  id: string
  date: string
  monthKey: string
  quantity: number
  material: string
  destination: string
  unitPrice: number
  totalPrice: number
}

const STORAGE_KEY = 'anotes-registros'

const MATERIAL_PRICES: Record<string, number> = {
  'Arena lavada': 230,
  Grava: 160,
  Gravilla: 170,
  Lama: 210,
  Piedra: 160,
  'Escombro (cubo)': 70,
  'Relleno (tierra)': 70,
  Retroexcavadora: 350,
}

const REMOVAL_MATERIALS = ['Escombro (cubo)', 'Relleno (tierra)']
const CHEAP_DELIVERY_MATERIALS = ['Grava', 'Lama', 'Piedra']
const PREMIUM_DELIVERY_MATERIALS = ['Arena lavada', 'Gravilla']
const DEPOSITO = 'Depósito'
const DAILY_EARNINGS_CAP = 4500

const CLIENTES = [
  'Arquitecto Limber',
  'Arquitecto Ibart',
  'Marcelo Mendoza',
  'Jose Albañil',
  'Luis Aramachi (Albañil)',
  'Don Sixto',
  'Don Neri',
  'Wilda Titi',
  'Sabaro Albañil',
  'Carmelo',
  'Carlos Quispe',
  'Martha Choque',
  'Ruben Flores',
  'Patricia Rojas',
]

const ZONAS = [DEPOSITO, 'Tirani', 'Tiquina', 'Taquiña', 'Chilimarca', 'Tiquipaya']

const getMonthKey = (dateText: string) => {
  const [year, month] = dateText.split('-')
  return `${year}-${month}`
}

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-')
  const monthNumber = Number(month)
  return `${MONTH_NAMES[monthNumber] ?? 'Mes'} ${year}`
}

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
}

const getAllowedMonths = (year: number) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

const pad = (value: number) => String(value).padStart(2, '0')

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const pickRandom = <T,>(items: T[]) => items[randomInt(0, items.length - 1)]

const createRandomNotesForYear = (year: number, months?: number[]) => {
  const notes: NoteItem[] = []
  const destinationsWithoutDeposito = [...CLIENTES, ...ZONAS.filter((z) => z !== DEPOSITO)]
  let sequence = 1

  const pushNote = (
    dateText: string,
    quantity: number,
    material: string,
    destination: string,
  ) => {
    const unitPrice = MATERIAL_PRICES[material] ?? 0
    notes.push({
      id: `auto-${dateText}-${sequence++}`,
      date: dateText,
      monthKey: getMonthKey(dateText),
      quantity,
      material,
      destination,
      unitPrice,
      totalPrice: quantity * unitPrice,
    })
  }

  const rebalanceSingleCubeTripsForDate = (dateText: string) => {
    let changed = true

    while (changed) {
      changed = false

      const dayIndexes = notes
        .map((note, index) => ({ note, index }))
        .filter(({ note }) => note.date === dateText && note.material !== 'Retroexcavadora')

      const singleEntry = dayIndexes.find(({ note }) => note.quantity === 1)
      if (!singleEntry) break

      const mergeTarget = dayIndexes.find(
        ({ note, index }) =>
          index !== singleEntry.index
          && note.unitPrice === singleEntry.note.unitPrice
          && note.quantity < 8,
      )

      if (mergeTarget) {
        const target = notes[mergeTarget.index]
        const updatedQuantity = target.quantity + 1

        notes[mergeTarget.index] = {
          ...target,
          quantity: updatedQuantity,
          totalPrice: updatedQuantity * target.unitPrice,
        }

        notes.splice(singleEntry.index, 1)
        changed = true
        continue
      }

      const splitSource = dayIndexes.find(
        ({ note, index }) =>
          index !== singleEntry.index
          && note.unitPrice === singleEntry.note.unitPrice
          && note.quantity >= 3,
      )

      if (splitSource) {
        const source = notes[splitSource.index]
        const single = notes[singleEntry.index]

        const sourceQuantity = source.quantity - 1
        const singleQuantity = single.quantity + 1

        notes[splitSource.index] = {
          ...source,
          quantity: sourceQuantity,
          totalPrice: sourceQuantity * source.unitPrice,
        }

        notes[singleEntry.index] = {
          ...single,
          quantity: singleQuantity,
          totalPrice: singleQuantity * single.unitPrice,
        }

        changed = true
      }
    }
  }

  const monthsToGenerate = months && months.length > 0
    ? months
    : Array.from({ length: 12 }, (_, i) => i + 1)

  for (const month of monthsToGenerate) {
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateObj = new Date(year, month - 1, day)
      const isSunday = dateObj.getDay() === 0
      const worksToday = Math.random() < (isSunday ? 0.35 : 0.92)
      if (!worksToday) continue

      const dateText = `${year}-${pad(month)}-${pad(day)}`
      const hasRemovalJobsToday = Math.random() < (isSunday ? 0.2 : 0.34)
      const targetCubes = isSunday
        ? hasRemovalJobsToday
          ? randomInt(18, 28)
          : randomInt(14, 22)
        : hasRemovalJobsToday
          ? Math.random() < 0.68
            ? randomInt(30, 36)
            : randomInt(27, 29)
          : Math.random() < 0.68
            ? randomInt(24, 30)
            : randomInt(21, 23)

      const isPlannedRetroDay = !isSunday && Math.random() < 0.22
      const plannedRetroHours = isPlannedRetroDay
        ? (targetCubes >= 45 ? randomInt(1, 2) : randomInt(1, 3))
        : 0
      const plannedRetroRevenue = plannedRetroHours * MATERIAL_PRICES.Retroexcavadora

      const targetDailyRevenue = isSunday
        ? randomInt(1800, 3200)
        : randomInt(3000, isPlannedRetroDay ? 4200 : 4000)
      const cappedDailyTarget = Math.min(targetDailyRevenue, DAILY_EARNINGS_CAP)
      const targetMaterialRevenue = Math.max(1800, cappedDailyTarget - plannedRetroRevenue)

      let remainingCubes = targetCubes
      let currentEarnings = 0
      let removalCubesDelivered = 0
      let escombroTripsDelivered = 0
      let rellenoTripsDelivered = 0
      const maxRemovalRatio = hasRemovalJobsToday
        ? (isSunday ? randomInt(15, 22) / 100 : randomInt(12, 18) / 100)
        : 0
      const maxRemovalCubes = maxRemovalRatio > 0
        ? Math.max(2, Math.floor(targetCubes * maxRemovalRatio))
        : 0
      const maxEscombroTrips = hasRemovalJobsToday ? (isSunday ? 1 : 2) : 0
      const maxRellenoTrips = hasRemovalJobsToday ? (isSunday ? 1 : 2) : 0
      const minUnitPriceToday = hasRemovalJobsToday ? 70 : 170

      // Cada día activo entra material al depósito (volqueta máxima de 8 cubos).
      const depositoQuantity = Math.min(8, remainingCubes)
      const depositoMaterial = Math.random() < 0.85
        ? pickRandom(CHEAP_DELIVERY_MATERIALS)
        : pickRandom(PREMIUM_DELIVERY_MATERIALS)
      pushNote(dateText, depositoQuantity, depositoMaterial, DEPOSITO)
      remainingCubes -= depositoQuantity
      currentEarnings += depositoQuantity * (MATERIAL_PRICES[depositoMaterial] ?? 0)

      while (remainingCubes > 0) {
        if (remainingCubes === 1) {
          const remainingRevenueCap = DAILY_EARNINGS_CAP - currentEarnings
          const mergeableNoteIndex = notes
            .map((note, index) => ({ note, index }))
            .reverse()
            .find(
              ({ note }) =>
                note.date === dateText
                && note.material !== 'Retroexcavadora'
                && note.quantity < 8
                && note.unitPrice <= remainingRevenueCap,
            )?.index

          if (mergeableNoteIndex !== undefined) {
            const noteToUpdate = notes[mergeableNoteIndex]
            const updatedQuantity = noteToUpdate.quantity + 1
            notes[mergeableNoteIndex] = {
              ...noteToUpdate,
              quantity: updatedQuantity,
              totalPrice: updatedQuantity * noteToUpdate.unitPrice,
            }
            remainingCubes -= 1
            currentEarnings += noteToUpdate.unitPrice
            continue
          }
        }

        let quantity = remainingCubes > 8 ? randomInt(6, 8) : Math.min(8, remainingCubes)
        const remainingRevenueCap = DAILY_EARNINGS_CAP - currentEarnings
        const remainingRevenueGoal = targetMaterialRevenue - currentEarnings
        const neededPerCube = remainingCubes > 0 ? remainingRevenueGoal / remainingCubes : 0

        // Asegurar que este viaje permita terminar el día sin superar el tope diario.
        while (quantity > 1) {
          const minFutureRevenue = (remainingCubes - quantity) * minUnitPriceToday
          const maxRevenueThisTrip = remainingRevenueCap - minFutureRevenue
          if (maxRevenueThisTrip >= quantity * minUnitPriceToday) break
          quantity -= 1
        }

        const minFutureRevenue = (remainingCubes - quantity) * minUnitPriceToday
        const maxRevenueThisTrip = remainingRevenueCap - minFutureRevenue
        const maxUnitPriceThisTrip = Math.floor(maxRevenueThisTrip / quantity)

        const removalProbability = !hasRemovalJobsToday
          ? 0
          : neededPerCube <= 90
            ? 0.18
            : neededPerCube <= 120
              ? 0.14
              : 0.1

        const removalCubesLeft = Math.max(0, maxRemovalCubes - removalCubesDelivered)
        const canUseRemovalForThisTrip = removalCubesLeft >= quantity
        const lastDayMaterial = [...notes]
          .reverse()
          .find((note) => note.date === dateText && note.material !== 'Retroexcavadora')?.material
        const canUseEscombroForThisTrip = canUseRemovalForThisTrip
          && escombroTripsDelivered < maxEscombroTrips
        const canUseRellenoForThisTrip = canUseRemovalForThisTrip
          && rellenoTripsDelivered < maxRellenoTrips

        let removalPool: string[] = []
        if (canUseEscombroForThisTrip && canUseRellenoForThisTrip) {
          if (lastDayMaterial === 'Escombro (cubo)') {
            removalPool = ['Relleno (tierra)']
          } else if (lastDayMaterial === 'Relleno (tierra)') {
            removalPool = ['Escombro (cubo)']
          } else {
            removalPool = Math.random() < 0.58 ? ['Escombro (cubo)'] : ['Relleno (tierra)']
          }
        } else if (canUseEscombroForThisTrip) {
          removalPool = ['Escombro (cubo)']
        } else if (canUseRellenoForThisTrip) {
          removalPool = ['Relleno (tierra)']
        }

        const candidateMaterials = [
          ...(canUseRemovalForThisTrip ? removalPool : []),
          ...CHEAP_DELIVERY_MATERIALS,
          ...PREMIUM_DELIVERY_MATERIALS,
        ]

        const allowedMaterials = candidateMaterials.filter(
          (name) => (MATERIAL_PRICES[name] ?? 0) <= maxUnitPriceThisTrip,
        )

        const useRemoval = removalPool.length > 0 && Math.random() < removalProbability
        const preferredPool = useRemoval
          ? removalPool
          : neededPerCube > 165 && Math.random() < 0.25
            ? PREMIUM_DELIVERY_MATERIALS
            : CHEAP_DELIVERY_MATERIALS

        const preferredAllowed = preferredPool.filter(
          (name) => (MATERIAL_PRICES[name] ?? 0) <= maxUnitPriceThisTrip,
        )

        const material = preferredAllowed.length > 0
          ? pickRandom(preferredAllowed)
          : allowedMaterials.length > 0
            ? pickRandom(allowedMaterials)
            : pickRandom(REMOVAL_MATERIALS)
        const destination = pickRandom(destinationsWithoutDeposito)

        pushNote(dateText, quantity, material, destination)
        remainingCubes -= quantity
        currentEarnings += quantity * (MATERIAL_PRICES[material] ?? 0)
        if (REMOVAL_MATERIALS.includes(material)) {
          removalCubesDelivered += quantity
          if (material === 'Escombro (cubo)') {
            escombroTripsDelivered += 1
          }
          if (material === 'Relleno (tierra)') {
            rellenoTripsDelivered += 1
          }
        }
      }

      if (plannedRetroHours > 0) {
        const retroHoursAllowedByCap = Math.floor((DAILY_EARNINGS_CAP - currentEarnings) / MATERIAL_PRICES.Retroexcavadora)
        const finalRetroHours = Math.min(plannedRetroHours, Math.max(0, retroHoursAllowedByCap))

        if (finalRetroHours > 0) {
          pushNote(
            dateText,
            finalRetroHours,
            'Retroexcavadora',
            pickRandom(destinationsWithoutDeposito),
          )
        }
      } else {
        const includeRetro = Math.random() < (isSunday ? 0.08 : 0.14)
        if (includeRetro) {
          // Si hubo 45+ cubos, limitar horas para mantener realismo operativo.
          const maxHours = targetCubes >= 45 ? 2 : targetCubes >= 42 ? 3 : isSunday ? 2 : 4
          const affordableHours = Math.floor((DAILY_EARNINGS_CAP - currentEarnings) / MATERIAL_PRICES.Retroexcavadora)
          const finalMaxHours = Math.min(maxHours, affordableHours)

          if (finalMaxHours >= 1) {
            const retroHours = randomInt(1, finalMaxHours)
            pushNote(dateText, retroHours, 'Retroexcavadora', pickRandom(destinationsWithoutDeposito))
          }
        }
      }

      rebalanceSingleCubeTripsForDate(dateText)
    }
  }

  return notes.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function App() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`

  const allowedMonths = getAllowedMonths(currentYear)
  const currentMonthKey = getMonthKey(todayText)
  const initialMonth = allowedMonths.includes(currentMonthKey)
    ? currentMonthKey
    : allowedMonths[0]

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return createRandomNotesForYear(currentYear)

    try {
      return JSON.parse(saved) as NoteItem[]
    } catch {
      return createRandomNotesForYear(currentYear)
    }
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth)
  const [date, setDate] = useState(todayText)
  const [quantity, setQuantity] = useState<number>(1)
  const [material, setMaterial] = useState<string>(Object.keys(MATERIAL_PRICES)[0])
  const [destination, setDestination] = useState<string>(CLIENTES[0])
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [excelMode, setExcelMode] = useState<'single' | 'separate'>('separate')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [generateMonths, setGenerateMonths] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, i) => i + 1),
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const unitPrice = MATERIAL_PRICES[material] ?? 0
  const totalPrice = quantity * unitPrice

  const monthFromDate = getMonthKey(date)
  const notesForMonth = notes.filter((item) => item.monthKey === selectedMonth)

  const handleAddNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!allowedMonths.includes(monthFromDate)) {
      setErrorMessage('Solo se permiten registros del año actual.')
      return
    }

    if (quantity <= 0) {
      setErrorMessage('La cantidad debe ser mayor a 0.')
      return
    }

    const newNote: NoteItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date,
      monthKey: monthFromDate,
      quantity,
      material,
      destination,
      unitPrice,
      totalPrice,
    }

    setNotes((prev) => [newNote, ...prev])
    setSelectedMonth(monthFromDate)
    setErrorMessage('')
    setStatusMessage('Anote guardado correctamente.')
  }

  const handleGenerateRandomData = () => {
    const generated = createRandomNotesForYear(currentYear, generateMonths)
    setNotes(generated)
    const firstMonth = generateMonths && generateMonths.length > 0 ? generateMonths[0] : 1
    setSelectedMonth(`${currentYear}-${String(firstMonth).padStart(2, '0')}`)
    setErrorMessage('')
    if (!generateMonths || generateMonths.length === 12) {
      setStatusMessage('Se generaron anotes aleatorios para el año actual.')
    } else {
      const names = generateMonths.map((m) => MONTH_NAMES[m]).filter(Boolean)
      setStatusMessage(`Se generaron anotes aleatorios para: ${names.join(', ')}.`)
    }
  }

  const handleClearNotes = () => {
    setNotes([])
    setErrorMessage('')
    setStatusMessage('Se limpiaron todos los anotes.')
  }

  const handleDownloadExcel = () => {
    if (notesForMonth.length === 0) {
      setErrorMessage('No hay datos para exportar en este mes.')
      setStatusMessage('')
      return
    }

    const detailRows = notesForMonth.map((item) => ({
      Fecha: item.date,
      Cantidad: item.quantity,
      'Material/trabajo': item.material,
      Destino: item.destination,
      'Precio unitario': item.unitPrice,
      'Precio total': item.totalPrice,
    }))

    const summaryRows = dailySummary.map((day) => ({
      Fecha: day.date,
      'Total cubos del día': day.cubes,
      'Total horas del día': day.hours,
      'Ganancia del día': day.earnings,
    }))

    const totalsRow = [
      {
        Mes: getMonthLabel(selectedMonth),
        'Total mes (Bs)': monthTotal,
        'Total cubos': totalCubes,
        'Total horas (Retroexcavadora)': totalHours,
      },
    ]

    const workbook = XLSX.utils.book_new()

    if (excelMode === 'single') {
      const oneSheetRows: (string | number)[][] = [
        ['Mes', getMonthLabel(selectedMonth)],
        ['Total mes (Bs)', monthTotal],
        ['Total cubos', totalCubes],
        ['Total horas (Retroexcavadora)', totalHours],
        [],
        ['Resumen diario'],
        ['Fecha', 'Total cubos del día', 'Total horas del día', 'Ganancia del día'],
        ...summaryRows.map((day) => [
          day.Fecha,
          day['Total cubos del día'],
          day['Total horas del día'],
          day['Ganancia del día'],
        ]),
        [],
        ['Detallado'],
        ['Fecha', 'Cantidad', 'Material/trabajo', 'Destino', 'Precio unitario', 'Precio total'],
        ...detailRows.map((row) => [
          row.Fecha,
          row.Cantidad,
          row['Material/trabajo'],
          row.Destino,
          row['Precio unitario'],
          row['Precio total'],
        ]),
      ]

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(oneSheetRows), 'Todo')
    } else {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Detallado')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalsRow), 'Totales')
    }

    XLSX.writeFile(workbook, `anotes-${selectedMonth}.xlsx`)
    setErrorMessage('')
    setStatusMessage('Excel descargado correctamente.')
  }

  const monthTotal = notesForMonth.reduce((acc, item) => acc + item.totalPrice, 0)
  const totalCubes = notesForMonth
    .filter((item) => item.material !== 'Retroexcavadora')
    .reduce((acc, item) => acc + item.quantity, 0)
  const totalHours = notesForMonth
    .filter((item) => item.material === 'Retroexcavadora')
    .reduce((acc, item) => acc + item.quantity, 0)

  const dailySummary = Object.values(
    notesForMonth.reduce<Record<string, { date: string; cubes: number; hours: number; earnings: number }>>(
      (acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date, cubes: 0, hours: 0, earnings: 0 }
        }

        if (item.material === 'Retroexcavadora') {
          acc[item.date].hours += item.quantity
        } else {
          acc[item.date].cubes += item.quantity
        }

        acc[item.date].earnings += item.totalPrice
        return acc
      },
      {},
    ),
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <main className="app-container">
      <header>
        <h1>Hoja de Anotes</h1>
        <p>Formato: Cantidad, Material/trabajo, Destino, Precio total.</p>
      </header>

      <section className="card">
        <h2>Nuevo anote</h2>
        <form className="form-grid" onSubmit={handleAddNote}>
          <label>
            Fecha
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          <label>
            Meses a generar
            <select
              multiple
              value={generateMonths.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
                setGenerateMonths(selected)
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </label>

          <label>
            Material/trabajo
            <select value={material} onChange={(e) => setMaterial(e.target.value)}>
              {Object.entries(MATERIAL_PRICES).map(([name, price]) => (
                <option key={name} value={name}>
                  {name} - Bs {price}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destino
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <optgroup label="Clientes">
                {CLIENTES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Zonas">
                {ZONAS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="total-box" aria-live="polite">
            Precio total: <strong>Bs {totalPrice}</strong>
          </div>

          <div className="form-actions">
            <button type="submit">Guardar anote</button>
            <button type="button" className="secondary" onClick={handleGenerateRandomData}>
              Generar anotes aleatorios
            </button>
            <button type="button" className="secondary danger" onClick={handleClearNotes}>
              Limpiar anotes
            </button>
          </div>
        </form>

        {errorMessage && <p className="error">{errorMessage}</p>}
        {statusMessage && <p className="status">{statusMessage}</p>}
      </section>

      <section className="card">
        <div className="month-header">
          <h2>Registros por mes</h2>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {allowedMonths.map((month) => (
              <option key={month} value={month}>
                {getMonthLabel(month)}
              </option>
            ))}
          </select>
        </div>

        <p className="month-total">
          Total del mes: <strong>Bs {monthTotal}</strong>
        </p>
        <p className="month-total">
          Total de cubos: <strong>{totalCubes}</strong>
        </p>
        <p className="month-total">
          Total de horas (Retroexcavadora): <strong>{totalHours}</strong>
        </p>

        <div className="month-actions">
          <select
            value={excelMode}
            onChange={(e) => setExcelMode(e.target.value as 'single' | 'separate')}
            aria-label="Modo de exportación Excel"
          >
            <option value="separate">Excel por separado</option>
            <option value="single">Excel en una sola hoja</option>
          </select>
          <button type="button" className="secondary" onClick={handleDownloadExcel}>
            Descargar Excel
          </button>
        </div>

        <div className="view-toggle" role="tablist" aria-label="Tipo de vista">
          <button
            type="button"
            className={viewMode === 'summary' ? 'active' : ''}
            onClick={() => setViewMode('summary')}
          >
            Ver resumen
          </button>
          <button
            type="button"
            className={viewMode === 'detailed' ? 'active' : ''}
            onClick={() => setViewMode('detailed')}
          >
            Ver detallado
          </button>
        </div>

        {viewMode === 'summary' ? (
          <>
            <h3>Resumen diario</h3>
            {dailySummary.length === 0 ? (
              <p>No hay resumen diario para este mes.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Total cubos del día</th>
                      <th>Total horas del día</th>
                      <th>Ganancia del día</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map((day) => (
                      <tr key={`summary-${day.date}`}>
                        <td>{day.date}</td>
                        <td>{day.cubes}</td>
                        <td>{day.hours}</td>
                        <td>Bs {day.earnings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : notesForMonth.length === 0 ? (
          <p>No hay anotes para este mes.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cantidad</th>
                  <th>Material/trabajo</th>
                  <th>Destino</th>
                  <th>Precio total</th>
                </tr>
              </thead>
              <tbody>
                {notesForMonth.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.quantity}</td>
                    <td>{item.material}</td>
                    <td>{item.destination}</td>
                    <td>Bs {item.totalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
