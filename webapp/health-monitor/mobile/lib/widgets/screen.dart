import 'package:flutter/material.dart';

import '../theme/colors.dart';

class Screen extends StatelessWidget {
  final String title;
  final bool refreshing;
  final Future<void> Function()? onRefresh;
  final List<Widget> children;

  const Screen({
    super.key,
    required this.title,
    this.refreshing = false,
    this.onRefresh,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final content = ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        Text(
          title,
          style: const TextStyle(color: AppColors.text, fontSize: 26, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        for (final child in children) ...[child, const SizedBox(height: 12)],
      ],
    );

    return SafeArea(
      child: onRefresh != null
          ? RefreshIndicator(
              color: AppColors.accent,
              onRefresh: onRefresh!,
              child: content,
            )
          : content,
    );
  }
}

class AppCard extends StatelessWidget {
  final String? title;
  final List<Widget> children;

  const AppCard({super.key, this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: const TextStyle(color: AppColors.text, fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
          ],
          ...children,
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final String text;
  const EmptyState({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted, fontSize: 13),
        ),
      ),
    );
  }
}
