from pathlib import Path

root = Path(r"c:\Users\navis\Downloads\but 6\but-6")

# --- TransactionModal ---
p = root / "components" / "TransactionModal.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace(
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4',
)
t = t.replace(
    'bg-white rounded-lg w-full max-w-md shadow-xl transform transition-all relative',
    'bg-white rounded-lg w-full max-w-md shadow-xl transform transition-all relative max-h-[92vh] overflow-y-auto',
)
t = t.replace(
    'absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9',
    'absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-8 h-8 sm:w-9 sm:h-9',
)
t = t.replace('<div className="p-6">', '<div className="p-4 sm:p-6">', 1)
t = t.replace(
    "text-2xl font-bold mb-4 pr-10",
    "text-lg sm:text-2xl font-bold mb-3 sm:mb-4 pr-10",
)
t = t.replace('className="mb-4"', 'className="mb-3 sm:mb-4"')
t = t.replace("text-gray-700 mb-2", "text-gray-700 mb-1 sm:mb-2")
t = t.replace("w-full px-4 py-2 border", "w-full px-3 py-1.5 sm:px-4 sm:py-2 border")
t = t.replace(
    "w-full text-white px-4 py-2 rounded-lg font-semibold",
    "w-full text-white px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base",
)
p.write_text(t, encoding="utf-8")
print("TransactionModal ok")

# --- DateInput ---
p = root / "components" / "DateInput.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace(
    'block text-sm font-semibold text-gray-700 mb-1',
    'block text-xs sm:text-sm font-semibold text-gray-700 mb-0.5 sm:mb-1',
)
t = t.replace(
    "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 bg-white placeholder-gray-400 font-sans",
    "w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base text-gray-900 bg-white placeholder-gray-400 font-sans",
)
t = t.replace(
    "absolute inset-0 px-4 py-2 border border-gray-300 rounded-lg bg-white flex items-center justify-between pointer-events-none",
    "absolute inset-0 px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg bg-white flex items-center justify-between pointer-events-none text-sm sm:text-base",
)
p.write_text(t, encoding="utf-8")
print("DateInput ok")

# --- Reports ---
p = root / "pages" / "ReportsPage" / "ReportsPage.view.tsx"
t = p.read_text(encoding="utf-8")
replacements = [
    ('space-y-6 animate-fade-in', 'space-y-3 sm:space-y-6 animate-fade-in'),
    ('bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500', 'bg-white rounded-lg shadow-md p-3 sm:p-6 border-l-4 border-indigo-500'),
    ('flex justify-between items-start mb-6', 'flex justify-between items-start gap-2 mb-3 sm:mb-6'),
    ('text-2xl font-bold text-gray-800', 'text-lg sm:text-2xl font-bold text-gray-800'),
    ('px-4 py-2 rounded-lg font-bold shadow-md', 'px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold shadow-md text-sm'),
    ('flex flex-col md:flex-row gap-6 items-end', 'flex flex-col md:flex-row gap-3 sm:gap-6 items-end'),
    ('w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500', 'w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm'),
    ('grid grid-cols-1 md:grid-cols-3 gap-6', 'grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6'),
    ('bg-green-50 p-5 rounded-lg', 'bg-green-50 p-3 sm:p-5 rounded-lg'),
    ('bg-red-50 p-5 rounded-lg', 'bg-red-50 p-3 sm:p-5 rounded-lg'),
    ('bg-white p-5 rounded-lg', 'bg-white p-3 sm:p-5 rounded-lg'),
    ('text-3xl font-bold text-gray-800', 'text-xl sm:text-3xl font-bold text-gray-800'),
    ('text-3xl font-bold ${netBalance', 'text-xl sm:text-3xl font-bold ${netBalance'),
    ('className="px-6 py-4"', 'className="px-3 py-2 sm:px-6 sm:py-4"'),
    ('className="px-6 py-4 text-right', 'className="px-3 py-2 sm:px-6 sm:py-4 text-right'),
    ('px-6 py-4 text-gray-600 whitespace-nowrap', 'px-3 py-2 sm:px-6 sm:py-4 text-gray-600 whitespace-nowrap'),
    ('className="px-6 py-4">', 'className="px-3 py-2 sm:px-6 sm:py-4">'),
    ('px-6 py-4 text-gray-600 max-w-xs', 'px-3 py-2 sm:px-6 sm:py-4 text-gray-600 max-w-xs'),
    ('text-right font-bold text-lg', 'text-right font-bold text-base sm:text-lg'),
    ('p-12 text-center text-gray-400 italic text-lg', 'p-6 sm:p-12 text-center text-gray-400 italic text-sm sm:text-lg'),
]
for a, b in replacements:
    if a not in t:
        print('WARN reports missing:', a[:60])
    else:
        t = t.replace(a, b)
p.write_text(t, encoding="utf-8")
print("Reports ok")

# --- Stock page ---
p = root / "pages" / "StockPage" / "StockPage.view.tsx"
t = p.read_text(encoding="utf-8")
stock_reps = [
    ('    <div className="space-y-6">', '    <div className="space-y-3 sm:space-y-6">'),
    ('       <div className="animate-fade-in space-y-6">', '       <div className="animate-fade-in space-y-3 sm:space-y-6">'),
    ('rounded-lg shadow-md p-6 border-l-8', 'rounded-lg shadow-md p-3 sm:p-6 border-l-4 sm:border-l-8'),
    ('text-5xl font-extrabold text-gray-900', 'text-3xl sm:text-5xl font-extrabold text-gray-900'),
    ('text-xl font-bold text-gray-500', 'text-base sm:text-xl font-bold text-gray-500'),
    ('w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', 'w-full rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm'),
    ('w-full px-4 py-3.5 pr-20 rounded-xl border text-lg font-semibold', 'w-full px-3 py-2.5 sm:px-4 sm:py-3.5 pr-16 sm:pr-20 rounded-xl border text-base sm:text-lg font-semibold'),
    ('bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl', 'bg-emerald-600 hover:bg-emerald-700 text-white py-2 sm:py-3 rounded-xl'),
    ('bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl', 'bg-rose-600 hover:bg-rose-700 text-white py-2 sm:py-3 rounded-xl'),
    ('bg-white rounded-lg shadow-md p-6 border-t-4 border-orange-500', 'bg-white rounded-lg shadow-md p-3 sm:p-6 border-t-4 border-orange-500'),
    ('text-xl font-bold text-gray-800 mb-6', 'text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-6'),
    ('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6', 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6'),
    ('fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4', 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4'),
    ('bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in relative', 'bg-white rounded-lg p-4 sm:p-6 w-full max-w-md shadow-xl animate-fade-in relative max-h-[92vh] overflow-y-auto'),
    ('text-xl font-bold mb-4 text-gray-800', 'text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800'),
    ('fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4', 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4'),
    ('bg-white rounded-lg p-6 w-full max-w-4xl shadow-2xl h-[80vh] flex flex-col animate-fade-in', 'bg-white rounded-lg p-3 sm:p-6 w-full max-w-4xl shadow-2xl h-[85vh] sm:h-[80vh] flex flex-col animate-fade-in'),
    ('text-2xl font-bold text-gray-800', 'text-lg sm:text-2xl font-bold text-gray-800'),
]
for a, b in stock_reps:
    c = t.count(a)
    if c == 0:
        print('WARN stock missing:', a[:70])
    else:
        t = t.replace(a, b)
# dispatch input text-lg
t = t.replace(
    'border-gray-300 focus:ring-orange-500\'}`}',
    'border-gray-300 focus:ring-orange-500 text-base sm:text-lg\'}`}',
)
p.write_text(t, encoding="utf-8")
print("Stock ok")

print("done batch 1")
