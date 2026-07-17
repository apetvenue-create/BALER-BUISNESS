from pathlib import Path
import re

root = Path(r"c:\Users\navis\Downloads\but 6\but-6")

# --- App.tsx transactions compaction ---
p = root / "App.tsx"
t = p.read_text(encoding="utf-8")

app_reps = [
    ('max-w-5xl mx-auto px-6 py-4 flex items-center justify-center gap-8',
     'max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-center gap-4 sm:gap-8'),
    ('main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 min-h-0 flex flex-col"',
     'main className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4 md:p-6 min-h-0 flex flex-col"'),
    ('lg:bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:p-6',
     'lg:bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:p-6'),
    ('div className="flex flex-col space-y-6"',
     'div className="flex flex-col space-y-3 sm:space-y-6"'),
    ('bg-white p-4 rounded-lg shadow-sm border border-gray-200',
     'bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200'),
    ('w-full max-w-3xl mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md px-5 py-5 sm:px-6 sm:py-6 text-white relative',
     'w-full max-w-3xl mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md px-3 py-3 sm:px-6 sm:py-6 text-white relative'),
    ('text-base sm:text-lg font-bold uppercase tracking-wider mb-4 pr-12 text-center opacity-95',
     'text-sm sm:text-lg font-bold uppercase tracking-wider mb-2 sm:mb-4 pr-12 text-center opacity-95'),
    ('grid grid-cols-3 gap-3 sm:gap-4',
     'grid grid-cols-3 gap-2 sm:gap-4'),
    ('bg-white/20 rounded-xl px-3 py-3.5 sm:px-4 sm:py-4 backdrop-blur-sm text-center min-w-0',
     'bg-white/20 rounded-lg sm:rounded-xl px-2 py-2 sm:px-4 sm:py-4 backdrop-blur-sm text-center min-w-0'),
    ('text-lg sm:text-xl font-extrabold tabular-nums leading-tight mt-1.5 break-all',
     'text-sm sm:text-xl font-extrabold tabular-nums leading-tight mt-1 break-all'),
    ('bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-red-500',
     'bg-white rounded-lg shadow-md p-3 sm:p-6 border-l-4 border-red-500'),
    ('bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-green-500',
     'bg-white rounded-lg shadow-md p-3 sm:p-6 border-l-4 border-green-500'),
    ('text-lg sm:text-xl font-extrabold tracking-wide uppercase text-red-700',
     'text-base sm:text-xl font-extrabold tracking-wide uppercase text-red-700'),
    ('text-lg sm:text-xl font-extrabold tracking-wide uppercase text-green-700',
     'text-base sm:text-xl font-extrabold tracking-wide uppercase text-green-700'),
    ('bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold',
     'bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm'),
    ('bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold',
     'bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-sm'),
    ('w-full max-w-3xl mx-auto bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-md px-5 py-5 sm:px-6 sm:py-6 text-white',
     'w-full max-w-3xl mx-auto bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-md px-3 py-3 sm:px-6 sm:py-6 text-white'),
    ('text-base sm:text-lg font-bold uppercase tracking-wider mb-4 text-center opacity-95',
     'text-sm sm:text-lg font-bold uppercase tracking-wider mb-2 sm:mb-4 text-center opacity-95'),
    # stats section
    ('bg-white rounded-lg shadow-md p-6 border-t-4 border-indigo-500',
     'bg-white rounded-lg shadow-md p-3 sm:p-6 border-t-4 border-indigo-500'),
    ('text-lg sm:text-xl font-extrabold tracking-wide uppercase text-indigo-900 mb-6',
     'text-base sm:text-xl font-extrabold tracking-wide uppercase text-indigo-900 mb-3 sm:mb-6'),
    ('flex flex-col md:flex-row gap-4 mb-8',
     'flex flex-col md:flex-row gap-2 sm:gap-4 mb-4 sm:mb-8'),
]

for a, b in app_reps:
    if a not in t:
        print('WARN app missing:', a[:80])
    else:
        t = t.replace(a, b)

# Stats cards - find and shrink text-3xl and p-5 in stats area
# Opening balance modal
t = t.replace(
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4',
)
t = t.replace(
    'bg-white rounded-lg p-6 w-full max-w-sm shadow-xl animate-fade-in relative',
    'bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl animate-fade-in relative',
)
t = t.replace(
    'text-xl font-bold mb-4">{t.editOpeningBalanceTitle}',
    'text-lg sm:text-xl font-bold mb-3 sm:mb-4">{t.editOpeningBalanceTitle}',
)

# Generic stats card paddings in transactions - replace remaining large stats
# Look for common pattern in stats section
t = t.replace('className="bg-white p-5 rounded-lg shadow-sm border', 'className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border')
t = t.replace('text-3xl font-bold text-indigo', 'text-xl sm:text-3xl font-bold text-indigo')
t = t.replace('text-3xl font-bold text-red', 'text-xl sm:text-3xl font-bold text-red')
t = t.replace('text-3xl font-bold text-green', 'text-xl sm:text-3xl font-bold text-green')
t = t.replace('text-3xl font-bold text-gray', 'text-xl sm:text-3xl font-bold text-gray')
t = t.replace('text-3xl font-bold text-blue', 'text-xl sm:text-3xl font-bold text-blue')
t = t.replace('text-3xl font-bold text-orange', 'text-xl sm:text-3xl font-bold text-orange')
t = t.replace('text-3xl font-bold text-purple', 'text-xl sm:text-3xl font-bold text-purple')
t = t.replace('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6')

p.write_text(t, encoding="utf-8")
print("App ok")

# --- AccountPage ---
p = root / "pages" / "AccountPage" / "AccountPage.view.tsx"
t = p.read_text(encoding="utf-8")

acc_reps = [
    # list search bar
    ('p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between',
     'p-3 sm:p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-2 sm:gap-4 items-center justify-between'),
    ('w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none',
     'w-full px-3 py-1.5 sm:px-4 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm'),
    ('flex-1 overflow-y-auto p-4',
     'flex-1 overflow-y-auto p-3 sm:p-4'),
    ('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
     'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'),
    # modal overlays
    ('fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
     'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4'),
    ('bg-white rounded-lg p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in',
     'bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto'),
    ('bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in relative',
     'bg-white rounded-lg p-4 sm:p-6 w-full max-w-md shadow-xl animate-fade-in relative max-h-[92vh] overflow-y-auto'),
    ('bg-white rounded-lg p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in relative',
     'bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in relative max-h-[92vh] overflow-y-auto'),
    # add account modal
    ('bg-white rounded-lg p-6 w-full shadow-xl transform transition-all animate-fade-in relative',
     'bg-white rounded-lg p-4 sm:p-6 w-full shadow-xl transform transition-all animate-fade-in relative'),
    ('text-xl font-bold mb-2 text-gray-800',
     'text-lg sm:text-xl font-bold mb-1 sm:mb-2 text-gray-800'),
    ('text-xl font-bold mb-4 text-gray-800',
     'text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800'),
    ('text-xl font-bold mb-4',
     'text-lg sm:text-xl font-bold mb-3 sm:mb-4'),
    # detail headers
    ('text-3xl font-bold text-gray-900',
     'text-xl sm:text-3xl font-bold text-gray-900'),
    ('text-2xl font-bold text-gray-900',
     'text-lg sm:text-2xl font-bold text-gray-900'),
    ('animate-fade-in space-y-6',
     'animate-fade-in space-y-3 sm:space-y-6'),
    ('animate-fade-in space-y-4',
     'animate-fade-in space-y-3 sm:space-y-4'),
]

for a, b in acc_reps:
    c = t.count(a)
    if c == 0:
        print('WARN account missing:', a[:70])
    else:
        t = t.replace(a, b)
        print(f'  replaced {c}x:', a[:50])

# Farmer details / large paddings
t = t.replace('px-6 py-7', 'px-4 py-4 sm:px-6 sm:py-7')
t = t.replace('p-6 space-y-6', 'p-3 sm:p-6 space-y-3 sm:space-y-6')
t = t.replace('px-4 py-3.5 text-lg', 'px-3 py-2 sm:px-4 sm:py-3.5 text-base sm:text-lg')
t = t.replace('className="mb-4"', 'className="mb-3 sm:mb-4"')
# account cards
t = t.replace("className={`p-4 rounded-xl border", "className={`p-3 sm:p-4 rounded-xl border")
t = t.replace("'h-32'", "'min-h-[6.5rem] sm:h-32'")
t = t.replace('text-lg font-bold', 'text-base sm:text-lg font-bold')
# don't over-replace text-lg font-bold everywhere - might be too broad. check

p.write_text(t, encoding="utf-8")
print("Account ok")

# Fix reports remaining px-6 py-4
p = root / "pages" / "ReportsPage" / "ReportsPage.view.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace('px-6 py-4', 'px-3 py-2 sm:px-6 sm:py-4')
p.write_text(t, encoding="utf-8")
print("Reports cells ok")

print("batch 2 done")
