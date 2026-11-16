import { useEffect, useMemo, useState } from "react";
import {
  Award,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HardHat,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { exportRows, type ExportFormat, type ExportRow } from "../export";
import type { DashboardData, RecordItem } from "../types";
const fmt = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const isApproved = (v: string | null | undefined) =>
  String(v ?? "")
    .toLowerCase()
    .includes("aprov");
const avg = (a: (number | null | undefined)[]) => {
  const v = a.filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x),
  );
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
};
const avgOrNull = (a: (number | null | undefined)[]) => {
  const v = a.filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x),
  );
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
};
const objectTitles: Record<string, string> = {
  O1: "Fundamentos de Eletricidade",
  O2: "Segurança em Instalações Elétricas",
  O3: "Acionamentos de máquinas",
  O4: "Inversor de Frequência",
  O5: "Máquinas elétricas",
  O6: "Dispositivos de Proteção de Equipamentos",
  O7: "Manobras Elétricas e Dispositivos (CCM e CJM)",
  O8: "Sistemas Auxiliares CA e CC",
  O9: "Análise de Falhas e Manutenção em Sistemas Elétricos",
  O10: "SPDA – Sistema de Proteção Contra Descargas Atmosféricas",
  O11: "Cabos elétricos",
};
const renderPieLabel = (p: { percent?: number }) =>
  `${((p.percent ?? 0) * 100).toFixed(1).replace(".", ",")}%`;
const uniqueByMatricula = (records: RecordItem[]) => [
  ...new Map(records.map((record) => [record.matricula, record])).values(),
];
const hasCompleteApplication = (record: RecordItem) =>
  Boolean(record.prova.trim()) &&
  record.nota !== null &&
  /^(aprovado|reprovado)$/i.test(String(record.resultado ?? "").trim());
const lowestAppliedScore = (items: RecordItem[]) => {
  const scores = items
    .filter(hasCompleteApplication)
    .map((record) => record.nota)
    .filter((value): value is number => value !== null);
  return scores.length ? Math.min(...scores) : null;
};
const absentFromBase = (target: RecordItem[], opposite: RecordItem[]) => {
  const targetGroups = new Map<string, RecordItem[]>();
  for (const record of target)
    targetGroups.set(record.matricula, [
      ...(targetGroups.get(record.matricula) ?? []),
      record,
    ]);
  const universe = uniqueByMatricula([...opposite, ...target]);
  return universe
    .filter(
      (person) =>
        !(targetGroups.get(person.matricula) ?? []).some(
          hasCompleteApplication,
        ),
    )
    .map((person) => (targetGroups.get(person.matricula) ?? [])[0] ?? person);
};
const summarize = (items: RecordItem[]) => ({
  total: items.length,
  approved: items.filter((x) => isApproved(x.resultado)).length,
  average: avg(items.map((x) => x.nota)),
  highest: items.length
    ? Math.max(
        ...items.map((x) => x.nota).filter((x): x is number => x !== null),
      )
    : null,
  lowest: lowestAppliedScore(items),
  difficulty: {
    facil: {
      percent: avgOrNull(items.map((x) => x.difficulty?.facil.percent)),
      points: avgOrNull(items.map((x) => x.difficulty?.facil.points)),
      max: 18,
    },
    medio: {
      percent: avgOrNull(items.map((x) => x.difficulty?.medio.percent)),
      points: avgOrNull(items.map((x) => x.difficulty?.medio.points)),
      max: 52,
    },
    dificil: {
      percent: avgOrNull(items.map((x) => x.difficulty?.dificil.percent)),
      points: avgOrNull(items.map((x) => x.difficulty?.dificil.points)),
      max: 30,
    },
  },
  scenarios: {
    cenario1: avgOrNull(items.map((x) => x.scenarios?.cenario1)),
    cenario2: avgOrNull(items.map((x) => x.scenarios?.cenario2)),
    cenario3: avgOrNull(items.map((x) => x.scenarios?.cenario3)),
    cenario4: avgOrNull(items.map((x) => x.scenarios?.cenario4)),
  },
  objects: Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => {
      const k = `O${i + 1}`;
      return [k, avg(items.map((x) => x.objects[k]))];
    }),
  ),
});
type Filters = {
  nome: string;
  genero: string;
  lider: string;
  gerencia: string;
  idadeInicial: string;
  idadeFinal: string;
  resultado: string;
  cargo: string;
  turno: string;
  prova: string;
};
const initial: Filters = {
  nome: "",
  genero: "",
  lider: "",
  gerencia: "",
  idadeInicial: "",
  idadeFinal: "",
  resultado: "",
  cargo: "",
  turno: "",
  prova: "",
};
const recordExportRow = (record: RecordItem): ExportRow => ({
  "Matrícula": record.matricula,
  "Nome": record.nome,
  "Gênero": record.genero,
  "Idade": record.idade === null ? null : Math.round(record.idade),
  "Cargo": record.cargo,
  "Líder": record.lider,
  "Gerência": record.gerencia,
  "Coordenação": record.coordenacao,
  "Turno": record.turno,
  "Prova": record.prova,
  "Data de aplicação": record.dataAplicacao,
  "Nota (%)": record.nota,
  "Resultado": record.resultado,
  "Admissão": record.admissao,
  "Tempo": record.tempo,
  "Situação": record.situacao,
  "Aplicador": record.aplicador,
  ...Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`O${index + 1} (%)`, record.objects[`O${index + 1}`]])),
});
const gapExportRow = (candidate: GapCandidate): ExportRow => ({
  "Matrícula": candidate.matricula,
  "Nome": candidate.nome,
  "Gênero": candidate.genero,
  "Idade": candidate.idade === null ? null : Math.round(candidate.idade),
  "Cargo": candidate.cargo,
  "Líder": candidate.lider,
  "Gerência": candidate.gerencia,
  "Turno": candidate.turno,
  "Prova teórica": candidate.provaT,
  "Nota teórica (%)": candidate.teorica,
  "Prova prática": candidate.provaP,
  "Nota prática (%)": candidate.pratica,
  "GAP (p.p.)": candidate.gap,
  "Status": candidate.status,
});
const Card = ({
  icon,
  title,
  value,
  detail,
  tone = "blue",
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  tone?: string;
  onClick?: () => void;
}) => (
  <div
    className={`kpi ${onClick ? "clickable-kpi" : ""}`}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) onClick();
    }}
  >
    <div className={`kpi-icon ${tone}`}>{icon}</div>
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </div>
);
const DifficultyCard = ({
  title,
  data,
  tone,
}: {
  title: string;
  data: { percent: number | null; points: number | null; max: number };
  tone: string;
}) => (
  <Card
    icon={<Target />}
    title={title}
    value={data.percent === null ? "—" : fmt(data.percent)}
    detail={
      data.points === null
        ? "Não disponível nesta base"
        : `${data.points.toFixed(1).replace(".", ",")} de ${data.max} pontos`
    }
    tone={tone}
  />
);
export default function Dashboard({
  mode,
}: {
  mode: "teorico" | "pratico" | "gap";
}) {
  const [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Filters>(initial),
    [open, setOpen] = useState(true),
    [selectedParticipant, setSelectedParticipant] = useState<string | null>(
      null,
    ),
    [absentModal, setAbsentModal] = useState(false),
    [exporting, setExporting] = useState<ExportFormat | null>(null),
    [exportError, setExportError] = useState("");
  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  const set = (k: keyof Filters, v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const matches = (r: RecordItem, result?: string) => {
    const min =
        filters.idadeInicial === "" ? null : Number(filters.idadeInicial),
      max = filters.idadeFinal === "" ? null : Number(filters.idadeFinal);
    return (
      (!filters.nome ||
        r.nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLocaleLowerCase("pt-BR") ===
          filters.nome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLocaleLowerCase("pt-BR")) &&
      (!filters.genero || r.genero === filters.genero) &&
      (!filters.lider || r.lider === filters.lider) &&
      (!filters.gerencia || r.gerencia === filters.gerencia) &&
      (!filters.cargo || r.cargo === filters.cargo) &&
      (!filters.turno || r.turno === filters.turno) &&
      (!filters.prova || r.prova === filters.prova) &&
      (!filters.resultado ||
        (result ?? (isApproved(r.resultado) ? "Aprovado" : "Reprovado")) ===
          filters.resultado) &&
      (min === null || (r.idade !== null && r.idade >= min)) &&
      (max === null || (r.idade !== null && r.idade <= max))
    );
  };
  const calc = useMemo(() => {
    if (!data) return null;
    const source =
        mode === "teorico" ? data.records.theoretical : data.records.practical,
      summary = summarize(source.filter((record) => matches(record))),
      tMap = new Map<string, RecordItem>();
    for (const record of data.records.theoretical) {
      const prior = tMap.get(record.matricula);
      if (
        !prior ||
        String(record.dataAplicacao ?? "") > String(prior.dataAplicacao ?? "")
      )
        tMap.set(record.matricula, record);
    }
    const pairs = data.records.practical.flatMap((p) => {
      const t = tMap.get(p.matricula);
      if (!t) return [];
      const status =
          isApproved(t.resultado) && isApproved(p.resultado)
            ? "Aprovado"
            : "Reprovado",
        merged = {
          ...t,
          ...p,
          genero: p.genero || t.genero,
          gerencia: p.gerencia || t.gerencia,
          lider: p.lider || t.lider,
          cargo: p.cargo || t.cargo,
          idade: p.idade ?? t.idade,
        };
      return matches(merged, status) ? [{ t, p, status, merged }] : [];
    });
    const theoretical = summarize(pairs.map((x) => x.t)),
      practical = summarize(pairs.map((x) => x.p)),
      candidates = pairs.map(({ t, p, status, merged }) => ({
        candidateKey: merged.candidateKey,
        matricula: merged.matricula,
        nome: merged.nome,
        genero: merged.genero,
        gerencia: merged.gerencia,
        lider: merged.lider,
        cargo: merged.cargo,
        idade: merged.idade,
        turno: merged.turno,
        provaT: t.prova,
        provaP: p.prova,
        teorica: t.nota ?? 0,
        pratica: p.nota ?? 0,
        gap: (p.nota ?? 0) - (t.nota ?? 0),
        status,
      })),
      gap = {
        matched: pairs.length,
        average: avg(candidates.map((c) => c.gap)),
        approvedBoth: candidates.filter((c) => c.status === "Aprovado").length,
        objects: Object.fromEntries(
          Array.from({ length: 11 }, (_, i) => {
            const k = `O${i + 1}`;
            return [k, practical.objects[k] - theoretical.objects[k]];
          }),
        ),
      };
    return {
      summary,
      theoretical,
      practical,
      candidates,
      gap,
      pairedRecords: pairs.map((x) => x.merged),
    };
  }, [data, mode, filters]);
  if (error) return <div className="empty error">{error}</div>;
  if (!data || !calc)
    return (
      <div className="loader page">
        <span />
      </div>
    );
  const isGap = mode === "gap",
    base =
      mode === "teorico" ? data.records.theoretical : data.records.practical,
    filteredBase = base.filter((record) => matches(record)),
    single = summarize(filteredBase),
    theoretical = isGap
      ? calc.theoretical
      : mode === "teorico"
        ? single
        : summarize(
            data.records.theoretical.filter((record) => matches(record)),
          ),
    practical = isGap
      ? calc.practical
      : mode === "pratico"
        ? single
        : summarize(data.records.practical.filter((record) => matches(record))),
    objects = Array.from({ length: 11 }, (_, i) => {
      const name = `O${i + 1}`;
      return {
        name,
        Teórica: theoretical.objects[name],
        Prática: practical.objects[name],
        GAP: calc.gap.objects[name],
      };
    }),
    total = isGap ? calc.gap.matched : calc.summary.total,
    approvedCount = isGap ? calc.gap.approvedBoth : calc.summary.approved,
    active = Object.values(filters).filter(Boolean).length,
    displayRecords = isGap ? calc.pairedRecords : filteredBase,
    applicationsCount = filteredBase.filter(hasCompleteApplication).length,
    absentRecords =
      mode === "pratico"
        ? absentFromBase(
            data.records.practical,
            data.records.theoretical,
          ).filter((record) => matches(record))
        : mode === "teorico"
          ? absentFromBase(
              data.records.theoretical,
              data.records.practical,
            ).filter((record) => matches(record))
          : [],
    participantNames = [
      ...new Set(
        [...data.records.theoretical, ...data.records.practical]
          .map((record) => record.nome)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    title =
      mode === "teorico"
        ? "Desempenho teórico"
        : mode === "pratico"
          ? "Desempenho prático"
          : "Desempenho por objeto";
  const exportData = isGap
      ? calc.candidates.map(gapExportRow)
      : filteredBase.map(recordExportRow),
    exportName = `certifica-vale-${mode}-${new Date().toISOString().slice(0, 10)}`;
  async function handleExport(format: ExportFormat) {
    setExporting(format);
    setExportError("");
    try {
      await exportRows(format, exportData, title, exportName);
    } catch (exportFailure) {
      setExportError((exportFailure as Error).message);
    } finally {
      setExporting(null);
    }
  }
  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <span className="eyebrow">PAINEL DE CERTIFICAÇÃO</span>
          <h1>{title}</h1>
          <p>
            {isGap
              ? "Comparativo teórico vs. prático"
              : "Visão consolidada dos resultados e objetos de conhecimento"}
          </p>
        </div>
        <div className="page-actions">
          <div className="export-actions" aria-label="Exportar dados filtrados">
            <span><Download />Exportar</span>
            <button onClick={() => handleExport("csv")} disabled={Boolean(exporting) || !exportData.length}>CSV</button>
            <button onClick={() => handleExport("xlsx")} disabled={Boolean(exporting) || !exportData.length}><FileSpreadsheet />Excel</button>
            <button onClick={() => handleExport("pdf")} disabled={Boolean(exporting) || !exportData.length}><FileText />PDF</button>
          </div>
          <button
            className={`filter-toggle ${active ? "active" : ""}`}
            onClick={() => setOpen(!open)}
          >
            <Filter />
            Filtros{active > 0 && <b>{active}</b>}
          </button>
        </div>
      </header>
      {exportError && <div className="alert error export-error">{exportError}</div>}
      {open && (
        <section className="filter-panel panel">
          <div className="filter-panel-head">
            <div>
              <h3>Filtros</h3>
              <p>Indicadores, gráficos e tabela respondem à seleção.</p>
            </div>
            <button onClick={() => setFilters(initial)} disabled={!active}>
              <RotateCcw />
              Limpar filtros
            </button>
          </div>
          <div className="filter-grid">
            <label className="name-filter">
              Nome completo
              <input
                type="search"
                value={filters.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Digite o nome do participante"
                autoComplete="off"
                list="participant-names"
              />
              <datalist id="participant-names">
                {participantNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <Select
              label="Gênero"
              value={filters.genero}
              values={data.filters.generos}
              all="Todos"
              onChange={(v) => set("genero", v)}
            />
            <Select
              label="Líder"
              value={filters.lider}
              values={data.filters.lideres}
              all="Todos"
              onChange={(v) => set("lider", v)}
            />
            <Select
              label="Gerência"
              value={filters.gerencia}
              values={data.filters.gerencias}
              all="Todas"
              onChange={(v) => set("gerencia", v)}
            />
            <Select
              label="Cargo"
              value={filters.cargo}
              values={data.filters.cargos}
              all="Todos"
              onChange={(v) => set("cargo", v)}
            />
            <Select
              label="Resultado"
              value={filters.resultado}
              values={["Aprovado", "Reprovado"]}
              all="Todos"
              onChange={(v) => set("resultado", v)}
            />
            <Select
              label="Turno"
              value={filters.turno}
              values={data.filters.turnos}
              all="Todos"
              onChange={(v) => set("turno", v)}
            />
            <Select
              label="Prova"
              value={filters.prova}
              values={data.filters.provas}
              all="Todas"
              onChange={(v) => set("prova", v)}
            />
            <div className="age-filter">
              <label>
                Idade inicial
                <input
                  type="number"
                  min="14"
                  max="100"
                  value={filters.idadeInicial}
                  onChange={(e) => set("idadeInicial", e.target.value)}
                  placeholder="18"
                />
              </label>
              <label>
                Idade final
                <input
                  type="number"
                  min="14"
                  max="100"
                  value={filters.idadeFinal}
                  onChange={(e) => set("idadeFinal", e.target.value)}
                  placeholder="65"
                />
              </label>
            </div>
          </div>
        </section>
      )}
      <div className="result-count">
        Exibindo <strong>{total}</strong> registro{total === 1 ? "" : "s"} com
        os filtros atuais
      </div>
      <section className="kpi-grid">
        {isGap ? (
          <>
            <Card
              icon={<BookOpen />}
              title="MÉDIA TEÓRICA"
              value={fmt(calc.theoretical.average)}
              detail="Candidatos filtrados"
            />
            <Card
              icon={<HardHat />}
              title="MÉDIA PRÁTICA"
              value={fmt(calc.practical.average)}
              detail="Candidatos filtrados"
              tone="cyan"
            />
            <Card
              icon={calc.gap.average >= 0 ? <TrendingUp /> : <TrendingDown />}
              title="GAP MÉDIO (P − T)"
              value={fmt(calc.gap.average)}
              detail="Diferença média"
              tone="purple"
            />
            <Card
              icon={<CheckCircle2 />}
              title="APROVADOS (AMBAS)"
              value={total ? fmt((approvedCount / total) * 100) : "0,0%"}
              detail={`${approvedCount} candidatos`}
              tone="green"
            />
            <Card
              icon={<XCircle />}
              title="REPROVADOS"
              value={
                total ? fmt(((total - approvedCount) / total) * 100) : "0,0%"
              }
              detail="Em uma ou ambas"
              tone="orange"
            />
            <Card
              icon={<Users />}
              title="CANDIDATOS PAREADOS"
              value={String(total)}
              detail="Matrícula + prova"
              tone="teal"
            />
          </>
        ) : (
          <>
            <Card
              icon={<Users />}
              title="APLICAÇÕES"
              value={String(applicationsCount)}
              detail="Provas devidamente aplicadas"
              tone="teal"
            />
            <Card
              icon={<Users />}
              title="PARTICIPANTES AUSENTES"
              value={String(absentRecords.length)}
              detail="Pendente de aplicação — clique para visualizar"
              tone="orange"
              onClick={() => setAbsentModal(true)}
            />
            <Card
              icon={<Target />}
              title="MÉDIA GERAL"
              value={fmt(calc.summary.average)}
              detail="Nota média filtrada"
            />
            <Card
              icon={<CheckCircle2 />}
              title="APROVADOS"
              value={String(approvedCount)}
              detail={total ? fmt((approvedCount / total) * 100) : "0,0%"}
              tone="green"
            />
            <Card
              icon={<XCircle />}
              title="REPROVADOS"
              value={String(total - approvedCount)}
              detail={
                total ? fmt(((total - approvedCount) / total) * 100) : "0,0%"
              }
              tone="orange"
            />
            {mode === "teorico" ? (
              <>
                <DifficultyCard
                  title="ACERTOS FÁCIL"
                  data={calc.summary.difficulty.facil}
                  tone="green"
                />
                <DifficultyCard
                  title="ACERTOS MÉDIO"
                  data={calc.summary.difficulty.medio}
                  tone="cyan"
                />
                <DifficultyCard
                  title="ACERTOS DIFÍCIL"
                  data={calc.summary.difficulty.dificil}
                  tone="purple"
                />
              </>
            ) : (
              <>
                <Card
                  icon={<Target />}
                  title="CENÁRIO 1"
                  value={
                    calc.summary.scenarios.cenario1 === null
                      ? "—"
                      : fmt(calc.summary.scenarios.cenario1)
                  }
                  detail="Média de acertos"
                  tone="green"
                />
                <Card
                  icon={<Target />}
                  title="CENÁRIO 2"
                  value={
                    calc.summary.scenarios.cenario2 === null
                      ? "—"
                      : fmt(calc.summary.scenarios.cenario2)
                  }
                  detail="Média de acertos"
                  tone="cyan"
                />
                <Card
                  icon={<Target />}
                  title="CENÁRIO 3"
                  value={
                    calc.summary.scenarios.cenario3 === null
                      ? "—"
                      : fmt(calc.summary.scenarios.cenario3)
                  }
                  detail="Média de acertos"
                  tone="purple"
                />
                <Card
                  icon={<Target />}
                  title="CENÁRIO 4"
                  value={
                    calc.summary.scenarios.cenario4 === null
                      ? "—"
                      : fmt(calc.summary.scenarios.cenario4)
                  }
                  detail="Média de acertos"
                  tone="orange"
                />
              </>
            )}
            <Card
              icon={<TrendingUp />}
              title="MAIOR NOTA"
              value={
                calc.summary.highest === null ? "—" : fmt(calc.summary.highest)
              }
              detail="Maior resultado filtrado"
              tone="green"
            />
            <Card
              icon={<TrendingDown />}
              title="MENOR NOTA"
              value={
                calc.summary.lowest === null ? "—" : fmt(calc.summary.lowest)
              }
              detail="Menor resultado filtrado"
              tone="orange"
            />
            <Card
              icon={<Award />}
              title="MELHOR OBJETO"
              value={
                Object.entries(calc.summary.objects).sort(
                  (a, b) => b[1] - a[1],
                )[0]?.[0] || "—"
              }
              detail={fmt(Math.max(...Object.values(calc.summary.objects), 0))}
              tone="purple"
            />
            <Card
              icon={<TrendingDown />}
              title="PIOR OBJETO"
              value={
                Object.entries(calc.summary.objects).sort(
                  (a, b) => a[1] - b[1],
                )[0]?.[0] || "—"
              }
              detail={fmt(Math.min(...Object.values(calc.summary.objects)))}
              tone="orange"
            />
          </>
        )}
      </section>
      <section className="chart-grid">
        <div className="panel wide">
          <div className="panel-title">
            <div>
              <h3>
                {isGap
                  ? "Comparativo por objeto"
                  : "Média por objeto de conhecimento"}
              </h3>
              <p>Percentual médio dos registros filtrados</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={objects} barGap={3}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} tickFormatter={(x) => `${x}%`} />
              <Tooltip content={<ObjectTooltip />} />
              {isGap && <Legend />}
              {isGap && (
                <Bar dataKey="Teórica" fill="#0755a6" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Teórica"
                    position="center"
                    angle={-90}
                    fill="#fff"
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                </Bar>
              )}
              <Bar
                dataKey={
                  isGap ? "Prática" : mode === "teorico" ? "Teórica" : "Prática"
                }
                fill={
                  isGap ? "#ff8a1f" : mode === "teorico" ? "#0755a6" : "#10a7b7"
                }
                radius={[4, 4, 0, 0]}
              >
                <LabelList
                  dataKey={
                    isGap
                      ? "Prática"
                      : mode === "teorico"
                        ? "Teórica"
                        : "Prática"
                  }
                  position="center"
                  angle={-90}
                  fill="#fff"
                  formatter={(v: unknown) => fmt(Number(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel donut">
          <h3>{isGap ? "Aprovação em ambas" : "Distribuição de resultados"}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Aprovados", value: approvedCount },
                  {
                    name: "Reprovados",
                    value: Math.max(total - approvedCount, 0),
                  },
                ]}
                dataKey="value"
                innerRadius={68}
                outerRadius={95}
                paddingAngle={2}
                label={renderPieLabel}
                labelLine={false}
              >
                {["#28b35a", "#e63838"].map((c) => (
                  <Cell key={c} fill={c} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [
                  `${value} (${total ? fmt((Number(value) / total) * 100) : "0,0%"})`,
                  "Participantes",
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-legend">
            <span>
              <i className="green" />
              Aprovados{" "}
              <b>
                {approvedCount} (
                {total ? fmt((approvedCount / total) * 100) : "0,0%"})
              </b>
            </span>
            <span>
              <i className="red" />
              Reprovados{" "}
              <b>
                {Math.max(total - approvedCount, 0)} (
                {total
                  ? fmt((Math.max(total - approvedCount, 0) / total) * 100)
                  : "0,0%"}
                )
              </b>
            </span>
          </div>
        </div>
      </section>
      {isGap && (
        <div className="gap-analysis-grid">
          <section className="panel gap-panel">
            <div className="panel-title">
              <div>
                <h3>Análise de GAP por objeto</h3>
                <p>Prática − Teórica para os candidatos filtrados</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={objects}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(x) => `${x}%`} />
                <Tooltip formatter={(x) => fmt(Number(x))} />
                <Bar dataKey="GAP" radius={[4, 4, 0, 0]}>
                  {objects.map((o) => (
                    <Cell
                      key={o.name}
                      fill={o.GAP >= 0 ? "#8152c9" : "#e63838"}
                    />
                  ))}
                  <LabelList
                    dataKey="GAP"
                    position="center"
                    angle={-90}
                    fill="#fff"
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
          <aside className="gap-interpretation panel">
            <h3>Como interpretar</h3>
            <div>
              <i className="purple" />
              <p>
                <strong>GAP &gt; 0</strong>
                <span>Prática melhor que Teórica</span>
              </p>
            </div>
            <div>
              <i className="red" />
              <p>
                <strong>GAP &lt; 0</strong>
                <span>Prática pior que Teórica</span>
              </p>
            </div>
          </aside>
        </div>
      )}
      <section className={`participant-grid ${isGap ? "ranking-only" : ""}`}>
        <ParticipantRanking
          mode={mode}
          records={filteredBase}
          candidates={calc.candidates}
          onSelect={(key) => setSelectedParticipant(key)}
        />
        {!isGap && (
          <SortableParticipantTable
            records={displayRecords}
            onSelect={(record) => setSelectedParticipant(record.candidateKey)}
          />
        )}
      </section>
      {isGap && (
        <>
          <CandidateTable
            candidates={calc.candidates}
            onSelect={(key) => setSelectedParticipant(key)}
          />
        </>
      )}
      {selectedParticipant && (
        <ParticipantModal
          data={data}
          candidateKey={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
        />
      )}
      {absentModal && (
        <AbsentParticipantsModal
          records={absentRecords}
          onClose={() => setAbsentModal(false)}
        />
      )}
    </div>
  );
}
function Select({
  label,
  value,
  values,
  all,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  all: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}

function ObjectTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>
        {label} — {objectTitles[label ?? ""]}
      </strong>
      {payload.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}: <b>{fmt(Number(item.value))}</b>
        </span>
      ))}
    </div>
  );
}

const participantColumns: Array<{ key: keyof RecordItem; label: string }> = [
  { key: "prova", label: "Prova" },
  { key: "matricula", label: "Matrícula" },
  { key: "nome", label: "Nome Completo" },
  { key: "idade", label: "Idade" },
  { key: "cargo", label: "Cargo" },
  { key: "gerencia", label: "Gerência" },
  { key: "coordenacao", label: "Coordenação" },
  { key: "lider", label: "Líder" },
  { key: "turno", label: "Letra do Turno" },
  { key: "admissao", label: "Admissão" },
  { key: "tempo", label: "Tempo" },
  { key: "genero", label: "Gênero" },
  { key: "dataAplicacao", label: "Data Aplicação" },
  { key: "situacao", label: "Situação" },
  { key: "aplicador", label: "Aplicador" },
];
function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number")
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(1).replace(".", ",");
  return String(value);
}
function SortableParticipantTable({
  records,
  onSelect,
}: {
  records: RecordItem[];
  onSelect: (record: RecordItem) => void;
}) {
  const [sort, setSort] = useState<keyof RecordItem>("nome"),
    [direction, setDirection] = useState<"asc" | "desc">("asc");
  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const x = a[sort],
          y = b[sort];
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const result =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
        return direction === "asc" ? result : -result;
      }),
    [records, sort, direction],
  );
  const change = (key: keyof RecordItem) => {
    if (sort === key) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection("asc");
    }
  };
  return (
    <section className="panel table-panel participant-table">
      <div className="panel-title">
        <div>
          <h3>Dados dos participantes</h3>
          <p>{records.length} registros conforme os filtros</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {participantColumns.map((c) => (
                <th key={c.key}>
                  <button onClick={() => change(c.key)}>
                    {c.label}
                    <ArrowUpDown />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.candidateKey}
                className="clickable-row"
                onClick={() => onSelect(r)}
                title="Abrir detalhes do participante"
              >
                {participantColumns.map((c) => (
                  <td key={c.key}>{displayValue(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ParticipantRanking({
  mode,
  records,
  candidates,
  onSelect,
}: {
  mode: "teorico" | "pratico" | "gap";
  records: RecordItem[];
  candidates: GapCandidate[];
  onSelect: (key: string) => void;
}) {
  const ranked = (
    mode === "gap"
      ? [...candidates]
      : records.map(
          (record) =>
            ({
              candidateKey: record.candidateKey,
              nome: record.nome,
              teorica: mode === "teorico" ? (record.nota ?? 0) : 0,
              pratica: mode === "pratico" ? (record.nota ?? 0) : 0,
              status: isApproved(record.resultado) ? "Aprovado" : "Reprovado",
            }) as GapCandidate,
        )
  ).sort((a, b) =>
    mode === "teorico"
      ? b.teorica - a.teorica
      : mode === "pratico"
        ? b.pratica - a.pratica
        : Math.max(b.teorica, b.pratica) - Math.max(a.teorica, a.pratica),
  );
  const width = Math.max(1100, ranked.length * 62);
  return (
    <section className="panel ranking-panel">
      <div className="panel-title">
        <div>
          <h3>Notas por participante</h3>
          <p>Da maior para a menor — clique em uma barra para ver detalhes</p>
        </div>
      </div>
      <div className="ranking-scroll">
        <div style={{ width }}>
          <BarChart
            width={width}
            height={mode === "gap" ? 570 : 430}
            data={ranked}
            margin={{ top: 25, right: 12, left: 8, bottom: 125 }}
            onClick={(state: any) => {
              const item = state?.activePayload?.[0]?.payload as
                GapCandidate | undefined;
              if (item) onSelect(item.candidateKey);
            }}
          >
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="nome"
              interval={0}
              angle={-55}
              textAnchor="end"
              height={125}
              tick={{ fontSize: 10 }}
            />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            {mode === "gap" && <Legend />}
            <Tooltip
              formatter={(v) => fmt(Number(v))}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.nome ?? ""}
            />
            {(mode === "gap" || mode === "teorico") && (
              <Bar
                dataKey="teorica"
                name="Teórica"
                fill="#0755a6"
                cursor="pointer"
                radius={[4, 4, 0, 0]}
              >
                {ranked.map((r) => (
                  <Cell
                    key={r.candidateKey}
                    stroke={r.status === "Aprovado" ? "#1b9b54" : "#d92f2f"}
                    strokeWidth={3}
                  />
                ))}
                <LabelList
                  dataKey="teorica"
                  position="center"
                  angle={-90}
                  formatter={(v: unknown) => fmt(Number(v))}
                  fill="#fff"
                  fontSize={10}
                />
              </Bar>
            )}
            {(mode === "gap" || mode === "pratico") && (
              <Bar
                dataKey="pratica"
                name="Prática"
                fill="#ff8a1f"
                cursor="pointer"
                radius={[4, 4, 0, 0]}
              >
                {ranked.map((r) => (
                  <Cell
                    key={r.candidateKey}
                    stroke={r.status === "Aprovado" ? "#1b9b54" : "#d92f2f"}
                    strokeWidth={3}
                  />
                ))}
                <LabelList
                  dataKey="pratica"
                  position="center"
                  angle={-90}
                  formatter={(v: unknown) => fmt(Number(v))}
                  fill="#fff"
                  fontSize={10}
                />
              </Bar>
            )}
          </BarChart>
        </div>
      </div>
    </section>
  );
}

type GapCandidate = {
  candidateKey: string;
  matricula: string;
  nome: string;
  genero: string | null;
  idade: number | null;
  cargo: string | null;
  lider: string | null;
  gerencia: string | null;
  turno: string | null;
  provaT: string;
  provaP: string;
  teorica: number;
  pratica: number;
  gap: number;
  status: string;
};
function SortHeader({
  label,
  field,
  onSort,
}: {
  label: string;
  field: keyof GapCandidate;
  onSort: (field: keyof GapCandidate) => void;
}) {
  return (
    <th>
      <button onClick={() => onSort(field)}>
        {label}
        <ArrowUpDown />
      </button>
    </th>
  );
}
function CandidateTable({
  candidates,
  onSelect,
}: {
  candidates: GapCandidate[];
  onSelect: (key: string) => void;
}) {
  const [sort, setSort] = useState<keyof GapCandidate>("nome"),
    [direction, setDirection] = useState<"asc" | "desc">("asc");
  const sorted = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const x = a[sort],
          y = b[sort];
        const result =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", {
                numeric: true,
              });
        return direction === "asc" ? result : -result;
      }),
    [candidates, sort, direction],
  );
  const change = (key: keyof GapCandidate) => {
    if (sort === key) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDirection("asc");
    }
  };
  return (
    <section className="panel table-panel">
      <div className="panel-title">
        <div>
          <h3>Desempenho dos candidatos</h3>
          <p>{candidates.length} registros pareados e filtrados</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <SortHeader label="Matrícula" field="matricula" onSort={change} />
              <SortHeader label="Nome" field="nome" onSort={change} />
              <SortHeader label="Gênero" field="genero" onSort={change} />
              <SortHeader label="Idade" field="idade" onSort={change} />
              <SortHeader label="Cargo" field="cargo" onSort={change} />
              <SortHeader label="Líder" field="lider" onSort={change} />
              <SortHeader label="Gerência" field="gerencia" onSort={change} />
              <SortHeader label="Turno" field="turno" onSort={change} />
              <SortHeader label="Prova T" field="provaT" onSort={change} />
              <SortHeader label="Nota T" field="teorica" onSort={change} />
              <SortHeader label="Prova P" field="provaP" onSort={change} />
              <SortHeader label="Nota P" field="pratica" onSort={change} />
              <SortHeader label="GAP" field="gap" onSort={change} />
              <SortHeader label="Status" field="status" onSort={change} />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((c) => (
              <tr
                key={`${c.matricula}-${c.provaT}-${c.provaP}`}
                className="clickable-row"
                onClick={() => onSelect(c.candidateKey)}
                title="Abrir detalhes do participante"
              >
                <td>{c.matricula}</td>
                <td>
                  <strong>{c.nome}</strong>
                </td>
                <td>{c.genero || "—"}</td>
                <td>{c.idade === null ? "—" : Math.round(c.idade)}</td>
                <td>{c.cargo || "—"}</td>
                <td>{c.lider || "—"}</td>
                <td>{c.gerencia || "—"}</td>
                <td>{c.turno || "—"}</td>
                <td>{c.provaT}</td>
                <td>{fmt(c.teorica)}</td>
                <td>{c.provaP}</td>
                <td>{fmt(c.pratica)}</td>
                <td className={c.gap >= 0 ? "positive" : "negative"}>
                  {c.gap >= 0 ? "+" : ""}
                  {fmt(c.gap)}
                </td>
                <td>
                  <span
                    className={`status ${c.status === "Aprovado" ? "approved" : "rejected"}`}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ParticipantModal({
  data,
  candidateKey,
  onClose,
}: {
  data: DashboardData;
  candidateKey: string;
  onClose: () => void;
}) {
  const exactT = data.records.theoretical.find(
      (r) => r.candidateKey === candidateKey,
    ),
    exactP = data.records.practical.find(
      (r) => r.candidateKey === candidateKey,
    ),
    matricula = exactP?.matricula ?? exactT?.matricula,
    t =
      exactT ??
      data.records.theoretical
        .filter((r) => r.matricula === matricula)
        .sort((a, b) =>
          String(b.dataAplicacao ?? "").localeCompare(
            String(a.dataAplicacao ?? ""),
          ),
        )[0],
    p =
      exactP ??
      data.records.practical
        .filter((r) => r.matricula === matricula)
        .sort((a, b) =>
          String(b.dataAplicacao ?? "").localeCompare(
            String(a.dataAplicacao ?? ""),
          ),
        )[0],
    person = p ?? t;
  if (!person) return null;
  const objects = Array.from({ length: 11 }, (_, i) => {
    const name = `O${i + 1}`;
    return {
      name,
      Teórica: t?.objects[name] ?? 0,
      Prática: p?.objects[name] ?? 0,
    };
  });
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="participant-modal">
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="modal-heading">
          <span className="eyebrow">DETALHES DO PARTICIPANTE</span>
          <h2>{person.nome}</h2>
          <p>
            {person.matricula} · Teórica {t?.prova ?? "—"} · Prática{" "}
            {p?.prova ?? "—"}
          </p>
        </div>
        <div className="modal-score-cards">
          <article>
            <span>Nota teórica</span>
            <strong>{fmt(t?.nota ?? 0)}</strong>
            <small>{t?.resultado ?? "Sem resultado"}</small>
          </article>
          <article>
            <span>Nota prática</span>
            <strong>{fmt(p?.nota ?? 0)}</strong>
            <small>{p?.resultado ?? "Sem resultado"}</small>
          </article>
        </div>
        <div className="modal-grid">
          <section className="panel">
            <h3>Dados do participante</h3>
            <dl className="modal-data">
              <div>
                <dt>Idade</dt>
                <dd>
                  {person.idade === null ? "—" : Math.round(person.idade)}
                </dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{person.cargo ?? "—"}</dd>
              </div>
              <div>
                <dt>Gerência</dt>
                <dd>{person.gerencia ?? "—"}</dd>
              </div>
              <div>
                <dt>Coordenação</dt>
                <dd>{person.coordenacao ?? "—"}</dd>
              </div>
              <div>
                <dt>Líder</dt>
                <dd>{person.lider ?? "—"}</dd>
              </div>
              <div>
                <dt>Turno</dt>
                <dd>{person.turno ?? "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h3>Notas gerais</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={[
                  {
                    name: "Notas",
                    Teórica: t?.nota ?? 0,
                    Prática: p?.nota ?? 0,
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
                <Bar dataKey="Teórica" fill="#0755a6">
                  <LabelList
                    dataKey="Teórica"
                    position="center"
                    angle={-90}
                    fill="#fff"
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                </Bar>
                <Bar dataKey="Prática" fill="#ff8a1f">
                  <LabelList
                    dataKey="Prática"
                    position="center"
                    angle={-90}
                    fill="#fff"
                    formatter={(v: unknown) => fmt(Number(v))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
        <section className="panel modal-objects">
          <h3>Resultados por objeto</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={objects}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ObjectTooltip />} />
              <Legend />
              <Bar dataKey="Teórica" fill="#0755a6">
                <LabelList
                  dataKey="Teórica"
                  position="center"
                  angle={-90}
                  fill="#fff"
                  formatter={(v: unknown) => fmt(Number(v))}
                />
              </Bar>
              <Bar dataKey="Prática" fill="#ff8a1f">
                <LabelList
                  dataKey="Prática"
                  position="center"
                  angle={-90}
                  fill="#fff"
                  formatter={(v: unknown) => fmt(Number(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Objeto</th>
                  <th>Teórica</th>
                  <th>Prática</th>
                  <th>GAP</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((row, i) => {
                  const tv = t?.objects[`O${i + 1}`] ?? null,
                    pv = p?.objects[`O${i + 1}`] ?? null,
                    g = tv !== null && pv !== null ? pv - tv : null;
                  return (
                    <tr key={row.name}>
                      <td>
                        <strong>
                          {row.name} — {objectTitles[row.name]}
                        </strong>
                      </td>
                      <td>{tv === null ? "—" : fmt(tv)}</td>
                      <td>{pv === null ? "—" : fmt(pv)}</td>
                      <td
                        className={
                          g === null ? "" : g >= 0 ? "positive" : "negative"
                        }
                      >
                        {g === null ? "—" : `${g >= 0 ? "+" : ""}${fmt(g)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function AbsentParticipantsModal({
  records,
  onClose,
}: {
  records: RecordItem[];
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="participant-modal">
        <button className="modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <div className="modal-heading">
          <span className="eyebrow">PENDÊNCIAS</span>
          <h2>Pendente de Aplicação</h2>
          <p>
            {records.length} participante{records.length === 1 ? "" : "s"} sem
            registro{records.length === 1 ? "" : "s"} na base oposta, mas
            ausente{records.length === 1 ? "" : "s"} nesta aplicação.
          </p>
        </div>
        {records.length === 0 ? (
          <div className="preview-empty">
            <CheckCircle2 />
            <strong>Nenhuma pendência encontrada</strong>
          </div>
        ) : (
          <div className="absent-list">
            {records.map((record) => (
              <div className="absent-item" key={record.candidateKey}>
                <strong>{record.matricula}</strong>
                <span>{record.nome}</span>
                <span>{record.cargo ?? "—"}</span>
                <span>{record.gerencia ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
