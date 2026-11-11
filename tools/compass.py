"""Compass rose after the one on the marina's plat: four long points split into two
tones, four short diagonal points, and N E S W. Drawn in the brand navy and orange."""
import math

def compass(cx, cy, r, north=0.0, cls='compass', letters=True, label_size=None):
    """north: screen bearing (degrees clockwise from up) that true north points to."""
    def pt(bearing, dist):
        a = math.radians(bearing)
        return cx + dist * math.sin(a), cy - dist * math.cos(a)
    def f(p): return f'{p[0]:.1f} {p[1]:.1f}'
    parts = []
    # short diagonal points first, so the long points sit on top
    for i, b in enumerate((45, 135, 225, 315)):
        b += north
        tip, l, rr = pt(b, r * 0.62), pt(b - 90, r * 0.1), pt(b + 90, r * 0.1)
        parts.append(f'<path class="{cls}__d1" d="M{f(tip)}L{cx:.1f} {cy:.1f}L{f(l)}Z"/>')
        parts.append(f'<path class="{cls}__d2" d="M{f(tip)}L{cx:.1f} {cy:.1f}L{f(rr)}Z"/>')
    for b in (0, 90, 180, 270):
        b += north
        tip, l, rr = pt(b, r), pt(b - 90, r * 0.14), pt(b + 90, r * 0.14)
        parts.append(f'<path class="{cls}__a" d="M{f(tip)}L{cx:.1f} {cy:.1f}L{f(l)}Z"/>')
        parts.append(f'<path class="{cls}__b" d="M{f(tip)}L{cx:.1f} {cy:.1f}L{f(rr)}Z"/>')
    parts.append(f'<circle class="{cls}__hub" cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 0.05:.1f}"/>')
    if letters:
        size = label_size or r * 0.32
        for t, b in (('N', 0), ('E', 90), ('S', 180), ('W', 270)):
            x, y = pt(b + north, r + size * 0.85)
            parts.append(f'<text class="{cls}__l{" " + cls + "__n" if t == "N" else ""}" x="{x:.1f}" y="{y:.1f}" '
                         f'font-size="{size:.1f}" text-anchor="middle" dominant-baseline="central">{t}</text>')
    return f'<g class="{cls}" aria-hidden="true">' + ''.join(parts) + '</g>'

CSS_DEFAULT = """
.compass__a { fill: #0D1A2B; } .compass__b { fill: #F37020; }
.compass__d1 { fill: #0D1A2B; opacity: .55; } .compass__d2 { fill: #fff; stroke: #0D1A2B; stroke-width: 1; stroke-opacity: .4; }
.compass__hub { fill: #fff; stroke: #0D1A2B; stroke-width: 1.5; }
.compass__l { font-family: 'Source Serif 4', Georgia, serif; fill: #0D1A2B; }
.compass__n { fill: #B24A0B; font-weight: 600; }
"""
