import React, { useEffect, useState } from 'react'
import { Spinner } from 'react-bootstrap'
import UplotReact from 'uplot-react';
import uPlot, { AlignedData } from 'uplot'

import { formatDuration, PROMETHEUS_URL } from '../../App'
import { ObjectivesApi, QueryRange } from '../../client'
import { IconExternal } from '../Icons'
import { greens, reds } from './colors';
import { labelsString } from "../../labels";
import { seriesGaps } from './gaps'

interface ErrorBudgetGraphProps {
  api: ObjectivesApi
  labels: { [key: string]: string }
  grouping: { [key: string]: string }
  timeRange: number,
  uPlotCursor: uPlot.Cursor,
}

const ErrorBudgetGraph = ({ api, labels, grouping, timeRange, uPlotCursor }: ErrorBudgetGraphProps): JSX.Element => {
  const [samples, setSamples] = useState<AlignedData>();
  const [query, setQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [start, setStart] = useState<number>()
  const [end, setEnd] = useState<number>()

  useEffect(() => {
    setLoading(true)

    const now = Date.now()
    const start = Math.floor((now - timeRange) / 1000)
    const end = Math.floor(now / 1000)

    api.getObjectiveErrorBudget({ expr: labelsString(labels), grouping: labelsString(grouping), start, end })
      .then((r: QueryRange) => {
        setSamples([
          r.values[0],
          r.values[1].map((v: number) => 100 * v)
        ])
        setQuery(r.query)
        setStart(start)
        setEnd(end)
      })
      .finally(() => setLoading(false))
  }, [api, labels, grouping, timeRange])

  if (!loading && samples === undefined) {
    return <>
      <h4>Error Budget</h4>
      <div><p>What percentage of the error budget is left over time?</p></div>
    </>
  }

  const canvasPadding = 20

  const budgetGradient = (u: uPlot) => {
    const width = u.ctx.canvas.width
    const height = u.ctx.canvas.height
    const min = u.scales['y'].min
    const max = u.scales['y'].max

    if (min == null || max == null) {
      return '#fff'
    }

    if (min > 0) {
      return `#${greens[0]}`
    }

    if (max < 0) {
      return `#${reds[0]}`
    }

    console.log(min, max)

    // TODO: This seems "good enough" but sometimes the gradient still reaches the wrong side.
    // Maybe it's a floating point thing?
    const zeroPercentage = 1 - (0 - min) / (max - min)

    const gradient = u.ctx.createLinearGradient(width / 2, canvasPadding - 2, width / 2, height - canvasPadding)
    gradient.addColorStop(0, `#${greens[0]}`)
    gradient.addColorStop(zeroPercentage, `#${greens[0]}`)
    gradient.addColorStop(zeroPercentage, `#${reds[0]}`)
    gradient.addColorStop(1, `#${reds[0]}`)
    return gradient
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h4>
          Error Budget
          {loading ? (
            <Spinner animation="border" style={{
              marginLeft: '1rem',
              marginBottom: '0.5rem',
              width: '1rem',
              height: '1rem',
              borderWidth: '1px'
            }}/>
          ) : <></>}
        </h4>
        {query !== '' ? (
          <a className="external-prometheus"
             target="_blank"
             rel="noreferrer"
             href={`${PROMETHEUS_URL}/graph?g0.expr=${encodeURIComponent(query)}&g0.range_input=${formatDuration(timeRange)}&g0.tab=0`}>
            <IconExternal height={20} width={20}/>
            Prometheus
          </a>
        ) : <></>}
      </div>
      <div>
        <p>What percentage of the error budget is left over time?</p>
      </div>

      {samples !== undefined && start !== undefined && end !== undefined ? (
        <UplotReact options={{
          width: 1000,
          height: 300,
          padding: [canvasPadding, 0, 0, canvasPadding],
          cursor: uPlotCursor,
          series: [{}, {
            fill: budgetGradient,
            gaps: seriesGaps(start, end)
          }],
          scales: {
            x: { min: start, max: end },
            y: {
              range: {
                min: {},
                max: { hard: 100 }
              }
            }
          },
          axes: [{}, {
            values: (uplot: uPlot, v: number[]) => (v.map((v: number) => `${v.toFixed(2)}%`))
          }]
        }} data={samples}/>
      ) : (
        <UplotReact options={{
          width: 1000,
          height: 300,
          series: [{}, {}],
          scales: {
            x: { min: start, max: end },
            y: { min: 0, max: 1 }
          }
        }} data={[[], []]}/>
      )}
    </>
  )
}

export default ErrorBudgetGraph
