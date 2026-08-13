import 'package:flutter/material.dart';

import '../theme/colors.dart';

class MetricCard extends StatelessWidget {
  final String icon;
  final String label;
  final String? value;
  final String? unit;
  final String? sub;
  final Color? color;

  const MetricCard({
    super.key,
    required this.icon,
    required this.label,
    this.value,
    this.unit,
    this.sub,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 150),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 2),
          RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: value ?? '—',
                  style: TextStyle(
                    color: color ?? AppColors.text,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (value != null && unit != null)
                  TextSpan(
                    text: ' $unit',
                    style: const TextStyle(color: AppColors.muted, fontSize: 13, fontWeight: FontWeight.normal),
                  ),
              ],
            ),
          ),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(sub!, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}
