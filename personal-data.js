// Personal record calculations, shared by the existing page and Node tests.
(function (root) {
  function numberOrNull(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function foodAmountCalories(food, amount) {
    const value = scaleFoodValue(food.kcal, amount, food.unit);
    return value == null ? null : Math.round(value);
  }
  function scaleFoodValue(value, amount, unit) {
    const base = numberOrNull(value), quantity = numberOrNull(amount);
    if (base == null || quantity == null || quantity <= 0) return null;
    return base * quantity / ((unit || 'g') === 'g' ? 100 : 1);
  }
  function summarizeItems(items) {
    let kcal = 0, known = 0, missing = 0;
    for (const item of items) {
      const value = numberOrNull(item.kcal);
      if (value != null) { kcal += value; known++; }
      if (value == null || item.partial) missing++;
    }
    return {kcal: known ? Math.round(kcal) : null, known, missing, count: items.length};
  }
  function summarizeDay(entry, items) {
    const manual = numberOrNull(entry && entry.calories);
    const sum = summarizeItems(items);
    return manual != null ? {...sum, kcal: manual, missing: 0, manual: true} : {...sum, manual: false};
  }
  function summarizeProtein(items) {
    let total = 0, known = 0, missing = 0;
    for (const item of items) {
      const value = numberOrNull(item.protein === undefined ? item.p : item.protein);
      if (value != null) { total += value; known++; }
      if (value == null || item.proteinPartial) missing++;
    }
    return {protein: known ? total : null, missing};
  }
  function makeFoodItem(food, amount) {
    const quantity = numberOrNull(amount), unit = food.unit || 'g';
    return {foodId: food.id, name: food.name, quantity, grams: unit === 'g' ? quantity : null,
      unit, kcal: foodAmountCalories(food, quantity), baseKcal: numberOrNull(food.kcal),
      protein: scaleFoodValue(food.p, quantity, unit), baseProtein: numberOrNull(food.p),
      notes: food.notes || '', source: food.source || '常用库估算'};
  }
  function resizeFoodItem(item, amount) {
    // Use the recorded value, so editing the library does not rewrite history.
    const oldAmount = numberOrNull(item.quantity == null ? item.grams : item.quantity);
    const unit = item.unit || 'g';
    const baseKcal = item.baseKcal !== undefined ? numberOrNull(item.baseKcal) :
      oldAmount > 0 && numberOrNull(item.kcal) != null ? item.kcal / oldAmount * (unit === 'g' ? 100 : 1) : null;
    const protein = numberOrNull(item.protein === undefined ? item.p : item.protein);
    const baseProtein = item.baseProtein !== undefined ? numberOrNull(item.baseProtein) :
      oldAmount > 0 && protein != null ? protein / oldAmount * (unit === 'g' ? 100 : 1) : null;
    return {...item, ...makeFoodItem({id: item.foodId, name: item.name, unit, kcal: baseKcal, p: baseProtein, notes: item.notes, source: item.source}, amount)};
  }
  function dinnerItem(selection, foods) {
    const parts = [], items = [];
    for (const [id, amount, fallback] of [
      [selection.vegetable, selection.vegetableAmount, selection.vegetable === 'usual-cabbage' ? '不到200g' : '份量未填'],
      [selection.meat, selection.meatAmount, '份量未填'],
      ...(selection.eggs ? [['usual-eggs', 2, '']] : []),
    ]) {
      const food = foods.find(f => f.id === id);
      if (!food) continue;
      const item = makeFoodItem(food, amount);
      items.push(item);
      parts.push(id === 'usual-eggs' ? '辣椒炒蛋（2个蛋）' : food.name + (item.quantity > 0 ? ` ${item.quantity}${item.unit}` : `（${fallback}）`));
    }
    const sum = summarizeItems(items), override = numberOrNull(selection.kcal);
    const protein = summarizeProtein(items), proteinOverride = numberOrNull(selection.protein);
    return {name: '常用晚餐', meal: '晚餐', details: parts.join(' · '), components: items,
      kcal: override != null ? override : sum.kcal, partial: override == null && (sum.missing > 0 || !!selection.extra),
      protein: proteinOverride ?? protein.protein, proteinPartial: proteinOverride == null && (protein.missing > 0 || !!selection.extra),
      notes: selection.notes || '生重，少油', source: override != null || proteinOverride != null ? '整餐粗估' : '常用库估算'};
  }
  function activityResult(workout, values) {
    const type = workout.type || 'minutes', amount = numberOrNull(values.amount);
    const units = {floors: '层', interval: '轮', seconds: '秒', reps: '次', minutes: '分钟'};
    const unit = units[type] || '次';
    if (amount == null || amount <= 0) throw new Error('请填写实际完成量。');
    if (['floors', 'interval', 'reps'].includes(type) && !Number.isInteger(amount)) throw new Error('层数、轮数和次数请填写整数。');
    const walkMinutes = numberOrNull(values.walkMinutes == null ? 2 : values.walkMinutes);
    const runMinutes = numberOrNull(values.runMinutes == null ? 1 : values.runMinutes);
    if (type === 'interval' && (!(walkMinutes > 0) || !(runMinutes > 0))) throw new Error('请填写每轮走、跑的分钟数。');
    const minutes = type === 'interval' ? amount * (walkMinutes + runMinutes) :
      type === 'seconds' ? amount / 60 : type === 'minutes' ? amount : numberOrNull(values.minutes);
    return {workoutId: workout.id, name: workout.name, type, amount, unit, minutes,
      ...(type === 'interval' ? {walkMinutes, runMinutes} : {}),
      kcal: numberOrNull(values.kcal), notes: String(values.notes || '').trim()};
  }
  const api = {numberOrNull, foodAmountCalories, summarizeItems, summarizeDay, summarizeProtein, makeFoodItem, resizeFoodItem, dinnerItem, activityResult};
  root.FitnessData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
