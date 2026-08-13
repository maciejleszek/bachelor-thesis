import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

import '../api/endpoints.dart';
import '../api/types.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';
import '../widgets/metric_card.dart';

const _metricsDays = 90;

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  bool _refreshing = false;
  Object? _error;
  Summary? _summary;
  List<DailyMetric> _metrics = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool refresh = false}) async {
    setState(() {
      if (refresh) {
        _refreshing = true;
      } else {
        _loading = true;
      }
      _error = null;
    });
    try {
      final results = await Future.wait([Api.getSummary(), Api.getMetrics(days: _metricsDays)]);
      setState(() {
        _summary = results[0] as Summary;
        _metrics = results[1] as List<DailyMetric>;
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  static String? _fmt(num? v, [int dec = 0]) => v?.toStringAsFixed(dec);

  static Color _stressColor(num? v) {
    if (v == null) return AppColors.muted;
    if (v < 35) return AppColors.accent2;
    if (v < 60) return AppColors.warn;
    return AppColors.danger;
  }

  DailyMetric _findLatestWithData() {
    for (final m in _metrics) {
      if (m.hasAnyData) return m;
    }
    return _metrics.isNotEmpty ? _metrics.first : DailyMetric(date: '', source: '');
  }

  List<FlSpot> _series(num? Function(DailyMetric) select) {
    final reversed = _metrics.reversed.toList();
    final spots = <FlSpot>[];
    var i = 0;
    for (final m in reversed) {
      final v = select(m);
      if (v != null) {
        spots.add(FlSpot(i.toDouble(), v.toDouble()));
      }
      i++;
    }
    return spots;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Screen(
        title: 'Dashboard',
        children: [Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: AppColors.accent)))],
      );
    }

    if (_error != null) {
      return Screen(
        title: 'Dashboard',
        onRefresh: () => _load(refresh: true),
        children: [
          EmptyState(
            text: 'Nie udało się połączyć z serwerem.\n$_error\n\nSprawdź adres API w zakładce Ustawienia.',
          ),
        ],
      );
    }

    final latest = _findLatestWithData();
    final latestSurvey = _summary?.surveys.isNotEmpty == true ? _summary!.surveys.first : null;
    final latestBp = _summary?.bloodPressure.isNotEmpty == true ? _summary!.bloodPressure.first : null;
    final sleepH = latest.sleepTotalMin != null ? (latest.sleepTotalMin!.toDouble() / 60).toStringAsFixed(1) : null;

    final hrSeries = _series((m) => m.avgHr);
    final hrvSeries = _series((m) => m.hrv);

    return Screen(
      title: 'Dashboard',
      onRefresh: () => _load(refresh: true),
      refreshing: _refreshing,
      children: [
        if (latest.date.isNotEmpty)
          Text('Najnowszy pomiar: ${latest.date} (${latest.source})',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _gridCard(MetricCard(
              icon: '❤️', label: 'Tętno śr.', color: AppColors.danger,
              value: _fmt(latest.avgHr), unit: 'bpm',
              sub: latest.restingHr != null ? 'Spocz. ${_fmt(latest.restingHr)} bpm' : null,
            )),
            _gridCard(MetricCard(
              icon: '💚', label: 'HRV', color: AppColors.accent2,
              value: _fmt(latest.hrv, 1), unit: 'ms',
            )),
            _gridCard(MetricCard(
              icon: '🫁', label: 'SpO₂', color: AppColors.accent,
              value: _fmt(latest.spo2, 1), unit: '%',
            )),
            _gridCard(MetricCard(
              icon: '😰', label: 'Stres śr.', color: _stressColor(latest.avgStress),
              value: _fmt(latest.avgStress), unit: '/100',
              sub: latest.maxStress != null ? 'Max ${_fmt(latest.maxStress)}' : null,
            )),
            _gridCard(MetricCard(
              icon: '👣', label: 'Kroki', color: AppColors.warn,
              value: latest.steps?.toStringAsFixed(0),
            )),
            _gridCard(MetricCard(
              icon: '🌙', label: 'Sen', color: AppColors.violet,
              value: sleepH, unit: 'h',
              sub: latest.sleepDeepMin != null ? 'Głęboki ${latest.sleepDeepMin!.round()} min' : null,
            )),
          ],
        ),
        Row(
          children: [
            Expanded(
              child: MetricCard(
                icon: '🩺', label: 'Ciśnienie',
                value: latestBp != null ? '${latestBp.sys.toInt()}/${latestBp.dia.toInt()}' : null,
                unit: 'mmHg',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: MetricCard(
                icon: '🎭', label: 'Stres (VAS)',
                value: latestSurvey?.vasStress?.toStringAsFixed(0),
                unit: '/100',
                sub: latestSurvey?.samValence != null ? 'Nastrój ${latestSurvey!.samValence}/9' : null,
              ),
            ),
          ],
        ),
        if (hrSeries.isNotEmpty)
          AppCard(
            title: 'Tętno — ostatnie ${hrSeries.length} pomiarów',
            children: [_lineChart(hrSeries, AppColors.danger, 140)],
          ),
        if (hrvSeries.isNotEmpty)
          AppCard(
            title: 'HRV — ostatnie ${hrvSeries.length} pomiarów',
            children: [_lineChart(hrvSeries, AppColors.accent2, 120)],
          ),
        if (_metrics.isEmpty)
          const EmptyState(text: 'Brak danych.\nDodaj metryki z poziomu backendu (sync Garmin/Mi Band).'),
      ],
    );
  }

  Widget _gridCard(Widget child) {
    final width = (MediaQuery.of(context).size.width - 32 - 10) / 2;
    return SizedBox(width: width, child: child);
  }

  Widget _lineChart(List<FlSpot> spots, Color color, double height) {
    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            drawVerticalLine: false,
            horizontalInterval: null,
            getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.border, strokeWidth: 1),
          ),
          borderData: FlBorderData(show: true, border: const Border(
            bottom: BorderSide(color: AppColors.border),
            left: BorderSide(color: AppColors.border),
          )),
          titlesData: const FlTitlesData(
            topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: true, reservedSize: 32, interval: null),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: false,
              color: color,
              barWidth: 2,
              dotData: const FlDotData(show: false),
            ),
          ],
        ),
      ),
    );
  }
}
