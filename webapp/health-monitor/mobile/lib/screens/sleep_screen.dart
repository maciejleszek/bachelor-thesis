import 'package:flutter/material.dart';

import '../api/endpoints.dart';
import '../api/types.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';

const _sleepDays = 365;
const _sleepLimit = 30;

class SleepScreen extends StatefulWidget {
  const SleepScreen({super.key});

  @override
  State<SleepScreen> createState() => _SleepScreenState();
}

class _SleepScreenState extends State<SleepScreen> {
  bool _loading = true;
  bool _refreshing = false;
  Object? _error;
  List<DailyMetric> _metrics = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool refresh = false}) async {
    setState(() {
      refresh ? _refreshing = true : _loading = true;
      _error = null;
    });
    try {
      final data = await Api.getMetrics(days: _sleepDays);
      setState(() => _metrics = data);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  static String _minToH(num? min) => min == null ? '—' : '${(min.toDouble() / 60).toStringAsFixed(1)} h';

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Screen(
        title: 'Sen',
        children: [Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: AppColors.accent)))],
      );
    }
    if (_error != null) {
      return Screen(
        title: 'Sen',
        onRefresh: () => _load(refresh: true),
        children: [EmptyState(text: 'Błąd połączenia: $_error')],
      );
    }

    final days = _metrics.where((m) => m.sleepTotalMin != null).take(_sleepLimit).toList();

    return Screen(
      title: 'Sen',
      onRefresh: () => _load(refresh: true),
      refreshing: _refreshing,
      children: [
        if (days.isEmpty) const EmptyState(text: 'Brak zapisanego snu w ostatnich $_sleepDays dniach.'),
        for (final d in days)
          AppCard(children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(d.date, style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w600, fontSize: 14)),
                Text(d.source.toUpperCase(), style: const TextStyle(color: AppColors.muted, fontSize: 11)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                _stat('Razem', _minToH(d.sleepTotalMin)),
                _stat('Głęboki', d.sleepDeepMin != null ? '${d.sleepDeepMin!.round()} min' : '—'),
                _stat('REM', d.sleepRemMin != null ? '${d.sleepRemMin!.round()} min' : '—'),
                _stat('Wynik', d.sleepScore != null ? '${d.sleepScore!.round()}' : '—'),
              ],
            ),
          ]),
      ],
    );
  }

  Widget _stat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(color: AppColors.violet, fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        ],
      ),
    );
  }
}
