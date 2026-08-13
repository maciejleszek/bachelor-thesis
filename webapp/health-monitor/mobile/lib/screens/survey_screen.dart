import 'package:flutter/material.dart';

import '../api/endpoints.dart';
import '../api/types.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';

class SurveyScreen extends StatefulWidget {
  const SurveyScreen({super.key});

  @override
  State<SurveyScreen> createState() => _SurveyScreenState();
}

class _SurveyScreenState extends State<SurveyScreen> {
  int _valence = 5;
  int _arousal = 5;
  int _dominance = 5;
  int _vasStress = 50;
  final _notesController = TextEditingController();

  bool _loadingSurveys = true;
  bool _refreshing = false;
  bool _submitting = false;
  List<Survey> _surveys = [];

  @override
  void initState() {
    super.initState();
    _loadSurveys();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadSurveys({bool refresh = false}) async {
    setState(() {
      refresh ? _refreshing = true : _loadingSurveys = true;
    });
    try {
      final data = await Api.getSurveys(limit: 20);
      setState(() => _surveys = data);
    } catch (_) {
      // widoczne jako pusta historia; formularz nowej ankiety nadal działa
    } finally {
      setState(() {
        _loadingSurveys = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await Api.postSurvey({
        'sam_valence': _valence,
        'sam_arousal': _arousal,
        'sam_dominance': _dominance,
        'vas_stress': _vasStress,
        'notes': _notesController.text.isEmpty ? null : _notesController.text,
      });
      _notesController.clear();
      await _loadSurveys();
      if (mounted) {
        _showAlert('Zapisano', 'Ankieta została zapisana.');
      }
    } catch (e) {
      if (mounted) _showAlert('Błąd', '$e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _delete(int id) async {
    await Api.deleteSurvey(id);
    _loadSurveys();
  }

  void _showAlert(String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(title, style: const TextStyle(color: AppColors.text)),
        content: Text(message, style: const TextStyle(color: AppColors.muted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Screen(
      title: 'Ankieta',
      onRefresh: () => _loadSurveys(refresh: true),
      refreshing: _refreshing,
      children: [
        AppCard(
          title: 'Nowy pomiar SAM / VAS',
          children: [
            _sliderRow('Nastrój (valence)', _valence, 1, 9, (v) => setState(() => _valence = v)),
            _sliderRow('Pobudzenie (arousal)', _arousal, 1, 9, (v) => setState(() => _arousal = v)),
            _sliderRow('Dominacja', _dominance, 1, 9, (v) => setState(() => _dominance = v)),
            Text('Stres (VAS 0-100): $_vasStress', style: const TextStyle(color: AppColors.text, fontSize: 13)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final n in [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
                  _pill('$n', n == _vasStress, () => setState(() => _vasStress = n)),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              minLines: 2,
              maxLines: 4,
              style: const TextStyle(color: AppColors.text),
              decoration: InputDecoration(
                hintText: 'Notatki (opcjonalnie)',
                hintStyle: const TextStyle(color: AppColors.muted),
                filled: true,
                fillColor: AppColors.surface2,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Zapisz', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
        const Text('Historia', style: TextStyle(color: AppColors.text, fontSize: 16, fontWeight: FontWeight.bold)),
        if (_loadingSurveys) const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        if (!_loadingSurveys && _surveys.isEmpty) const EmptyState(text: 'Brak zapisanych ankiet.'),
        for (final s in _surveys)
          AppCard(children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.date, style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(
                        'VAS ${s.vasStress ?? '—'} · SAM ${s.samValence ?? '—'}/${s.samArousal ?? '—'}/${s.samDominance ?? '—'}',
                        style: const TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                      if (s.notes != null && s.notes!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(s.notes!, style: const TextStyle(color: AppColors.muted, fontSize: 12, fontStyle: FontStyle.italic)),
                      ],
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _delete(s.id),
                  child: const Text('Usuń', style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ]),
      ],
    );
  }

  Widget _sliderRow(String label, int value, int min, int max, ValueChanged<int> onChange) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$label: $value', style: const TextStyle(color: AppColors.text, fontSize: 13)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (var n = min; n <= max; n++) _pill('$n', n == value, () => onChange(n)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 32),
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppColors.accent : AppColors.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: active ? AppColors.accent : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(color: active ? Colors.white : AppColors.muted, fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
