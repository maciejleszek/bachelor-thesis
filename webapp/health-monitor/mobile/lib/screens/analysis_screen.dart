import 'package:flutter/material.dart';

import '../api/endpoints.dart';
import '../api/types.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';

const _metricLabels = {
  'hrv': 'HRV',
  'resting_hr': 'Tętno spoczynkowe',
  'sleep_score': 'Wynik snu',
  'sleep_total_min': 'Czas snu',
  'spo2': 'SpO₂',
  'avg_stress': 'Stres (Garmin)',
};

class AnalysisScreen extends StatefulWidget {
  const AnalysisScreen({super.key});

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  bool _loading = true;
  bool _refreshing = false;
  Object? _error;
  CorrelationResult? _result;

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
      final data = await Api.getCorrelation();
      setState(() => _result = data);
    } catch (e) {
      setState(() => _error = e);
    } finally {
      setState(() {
        _loading = false;
        _refreshing = false;
      });
    }
  }

  static Color _corrColor(double? r) {
    if (r == null) return AppColors.muted;
    final abs = r.abs();
    if (abs >= 0.5) return AppColors.danger;
    if (abs >= 0.3) return AppColors.warn;
    return AppColors.accent2;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Screen(
        title: 'Analiza',
        children: [Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator(color: AppColors.accent)))],
      );
    }
    if (_error != null) {
      return Screen(
        title: 'Analiza',
        onRefresh: () => _load(refresh: true),
        children: [EmptyState(text: 'Błąd połączenia: $_error')],
      );
    }

    final entries = _result?.correlations.entries.toList() ?? [];

    return Screen(
      title: 'Analiza',
      onRefresh: () => _load(refresh: true),
      refreshing: _refreshing,
      children: [
        AppCard(
          title: 'Korelacja stresu (VAS) z metrykami',
          children: [
            if (entries.isEmpty)
              const EmptyState(text: 'Za mało wspólnych danych (ankiety + metryki) do policzenia korelacji.'),
            for (final e in entries)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        _metricLabels[e.key] ?? e.key,
                        style: const TextStyle(color: AppColors.text, fontSize: 13),
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          e.value.r != null ? e.value.r!.toStringAsFixed(2) : '—',
                          style: TextStyle(color: _corrColor(e.value.r), fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(width: 8),
                        Text('n=${e.value.n}', style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        ),
        const Text(
          'Wartości bliskie 1 lub -1 oznaczają silny związek ze stresem odczuwanym (VAS); n to liczba dni z pełnymi danymi.',
          style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.3),
        ),
      ],
    );
  }
}
