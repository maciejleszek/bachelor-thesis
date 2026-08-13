import 'package:flutter/material.dart';

import '../api/client.dart';
import '../api/endpoints.dart';
import '../theme/colors.dart';
import '../widgets/screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

enum _TestStatus { idle, ok, error }

class _SettingsScreenState extends State<SettingsScreen> {
  final _urlController = TextEditingController();
  String _defaultUrl = '';
  bool _testing = false;
  _TestStatus _status = _TestStatus.idle;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final url = await getApiUrl();
    setState(() {
      _urlController.text = url;
      _defaultUrl = getDefaultApiUrl();
    });
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _onSave() async {
    await setApiUrl(_urlController.text);
    setState(() => _status = _TestStatus.idle);
    _showAlert('Zapisano', 'Adres API został zaktualizowany.');
  }

  Future<void> _onTest() async {
    setState(() {
      _testing = true;
      _status = _TestStatus.idle;
    });
    try {
      await setApiUrl(_urlController.text);
      await Api.health();
      setState(() => _status = _TestStatus.ok);
    } catch (_) {
      setState(() => _status = _TestStatus.error);
    } finally {
      setState(() => _testing = false);
    }
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
      title: 'Ustawienia',
      children: [
        AppCard(
          title: 'Adres backendu (FastAPI)',
          children: [
            TextField(
              controller: _urlController,
              keyboardType: TextInputType.url,
              autocorrect: false,
              style: const TextStyle(color: AppColors.text),
              decoration: InputDecoration(
                hintText: 'http://192.168.1.10/api',
                hintStyle: const TextStyle(color: AppColors.muted),
                filled: true,
                fillColor: AppColors.surface2,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
              ),
            ),
            const SizedBox(height: 6),
            Text('Domyślny: $_defaultUrl', style: const TextStyle(color: AppColors.muted, fontSize: 11)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _testing ? null : _onTest,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.accent),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _testing
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 2))
                        : const Text('Testuj', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _onSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Zapisz', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
            if (_status == _TestStatus.ok)
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text('✅ Połączono z backendem.', style: TextStyle(color: AppColors.accent2, fontSize: 12)),
              ),
            if (_status == _TestStatus.error)
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text('❌ Brak połączenia — sprawdź adres i sieć.', style: TextStyle(color: AppColors.danger, fontSize: 12)),
              ),
          ],
        ),
        const Text(
          'Backend jest wystawiony przez nginx pod ścieżką /api (port 80).\n'
          'Fizyczny telefon: lokalne IP komputera w Wi-Fi (np. http://192.168.1.10/api).\n'
          'Emulator Androida: http://10.0.2.2/api.\n'
          'Build produkcyjny: publiczny adres backendu (https://.../api).',
          style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.3),
        ),
      ],
    );
  }
}
