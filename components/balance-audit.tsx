'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { auditBalances, fixAllBalances } from '@/app/actions/audit-balances'
import { Search, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react'

type AuditResult = {
    name: string
    userId: string
    currentUsed: number
    currentPending: number
    correctUsed: number
    correctPending: number
    usedDiff: number
    pendingDiff: number
    hasIssue: boolean
}

export function BalanceAudit() {
    const [results, setResults] = useState<AuditResult[]>([])
    const [loading, setLoading] = useState(false)
    const [fixing, setFixing] = useState(false)
    const [fixResult, setFixResult] = useState<{ fixed: number, details: string[] } | null>(null)
    const [audited, setAudited] = useState(false)

    const runAudit = async () => {
        setLoading(true)
        setFixResult(null)
        const { results } = await auditBalances()
        setResults(results)
        setAudited(true)
        setLoading(false)
    }

    const runFix = async () => {
        if (!confirm('¿Estás seguro? Esto corregirá TODOS los saldos inconsistentes recalculando desde el historial de solicitudes.')) return
        setFixing(true)
        const result = await fixAllBalances()
        setFixResult(result)
        setFixing(false)
        // Re-auditar para ver el resultado
        await runAudit()
    }

    const issueCount = results.filter(r => r.hasIssue).length

    return (
        <Card className="border-l-4 border-l-purple-400 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Search className="h-5 w-5 text-purple-500" />
                        Auditoría de Saldos
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button
                            onClick={runAudit}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                            className="text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
                        >
                            <Search className="h-3.5 w-3.5 mr-1" />
                            {loading ? 'Analizando...' : 'Auditar'}
                        </Button>
                        {issueCount > 0 && (
                            <Button
                                onClick={runFix}
                                disabled={fixing}
                                size="sm"
                                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Wrench className="h-3.5 w-3.5 mr-1" />
                                {fixing ? 'Corrigiendo...' : `Corregir ${issueCount}`}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {fixResult && (
                    <div className="mx-5 mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                        <p className="font-bold">✅ {fixResult.fixed} saldo{fixResult.fixed !== 1 ? 's' : ''} corregido{fixResult.fixed !== 1 ? 's' : ''}</p>
                        {fixResult.details.map((d, i) => (
                            <p key={i} className="mt-1 text-green-700">{d}</p>
                        ))}
                    </div>
                )}

                {audited && results.length > 0 && (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-4 font-semibold text-slate-500">Empleado</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Usados (BD)</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Usados (Real)</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Pendientes (BD)</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Pendientes (Real)</th>
                                    <th className="text-center py-2 px-3 font-semibold text-slate-500">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r) => (
                                    <tr key={r.userId} className={`border-b border-slate-50 ${r.hasIssue ? 'bg-red-50/50' : ''}`}>
                                        <td className="py-2 px-4 font-medium text-slate-800">{r.name}</td>
                                        <td className={`text-center py-2 px-3 font-mono ${r.usedDiff !== 0 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                            {r.currentUsed}
                                        </td>
                                        <td className="text-center py-2 px-3 font-mono text-slate-600">{r.correctUsed}</td>
                                        <td className={`text-center py-2 px-3 font-mono ${r.pendingDiff !== 0 ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                            {r.currentPending}
                                        </td>
                                        <td className="text-center py-2 px-3 font-mono text-slate-600">{r.correctPending}</td>
                                        <td className="text-center py-2 px-3">
                                            {r.hasIssue ? (
                                                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                                    <AlertTriangle className="h-3 w-3" /> Error
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-green-600">
                                                    <CheckCircle2 className="h-3 w-3" /> OK
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {audited && issueCount === 0 && results.length > 0 && (
                    <div className="p-6 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-600">Todos los saldos están correctos</p>
                        <p className="text-xs text-slate-400 mt-1">{results.length} empleados auditados</p>
                    </div>
                )}

                {!audited && (
                    <div className="p-6 text-center text-xs text-slate-400">
                        Haz clic en "Auditar" para comparar los saldos de la BD contra el historial real de solicitudes.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}