# C# / WPF Code Review Checklist

Language and framework-specific items for C# with WPF applications.

## Build Command
```
dotnet build
```

## WPF-Specific Items (9)

### 1. Dispatcher Thread Safety
- Is `ObservableCollection` modified from a non-UI thread?
- Are UI elements accessed from background threads?
- Fix: `Application.Current.Dispatcher.Invoke()` or `Dispatcher.BeginInvoke()`

### 2. INotifyPropertyChanged
- Does the ViewModel property raise `PropertyChanged` when its value changes?
- Is `OnPropertyChanged()` / `RaisePropertyChanged()` called in the setter?
- Missing notification = UI binding won't update

### 3. DataContext Propagation
- Does child control inherit parent's DataContext correctly?
- Does an explicit `DataContext = ...` on a child break inheritance chain?
- Check: is `{Binding Path=...}` resolving against the intended DataContext?

### 4. Binding Path Validity
- Does `{Binding Path=PropertyName}` match an actual property on the DataContext?
- Case sensitivity: `path` ≠ `Path` in property names
- Collection bindings: is `ItemsSource` bound to an `ObservableCollection`?

### 5. Command Binding
- Does `ICommand` implementation (`RelayCommand`, `DelegateCommand`) properly raise `CanExecuteChanged`?
- Is `CommandParameter` binding resolving correctly?

### 6. Resource / Style Resolution
- Are `StaticResource` / `DynamicResource` keys defined and accessible?
- Is resource dictionary merged in the correct scope (App.xaml, Window, UserControl)?

### 7. Memory Leaks
- Are event handlers unsubscribed in `Unloaded` or `Dispose`?
- Are strong references to ViewModels preventing garbage collection?
- `WeakEventManager` for long-lived event sources

### 8. Value Converter Safety
- Does `IValueConverter.Convert()` handle null, `DependencyProperty.UnsetValue`, unexpected types?
- Does `ConvertBack()` handle round-trip correctly?

### 9. XAML Designer Compatibility
- Does `d:DataContext` provide design-time data?
- Are `x:Name` references valid and not duplicated?
- Does the control render without runtime-only dependencies?
