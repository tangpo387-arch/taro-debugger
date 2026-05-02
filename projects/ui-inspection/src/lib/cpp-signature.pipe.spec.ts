import { CppSignaturePipe } from './cpp-signature.pipe';
import { describe, it, expect } from 'vitest';

describe('CppSignaturePipe', () => {
  const pipe = new CppSignaturePipe();

  it('creates an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('simplifies template arguments', () => {
    const input = 'std::vector<std::string, std::allocator<std::string>>::push_back(const std::string&)';
    const expected = 'std::vector<...>::push_back(...)';
    expect(pipe.transform(input)).toBe(expected);
  });

  it('handles operator overloads gracefully without mangling', () => {
    // If it contains "operator", it should only collapse parens, not angle brackets
    const input = 'MyClass::operator<<(std::ostream&, const MyClass&)';
    const expected = 'MyClass::operator<<(...)';
    expect(pipe.transform(input)).toBe(expected);

    const input2 = 'std::less<int>::operator()(const int&, const int&)';
    const expected2 = 'std::less<...>::operator()(...)'; // Parens and angle brackets collapsed safely!
    expect(pipe.transform(input2)).toBe(expected2);
  });

  it('returns original string if brackets are unbalanced', () => {
    const input = 'foo<bar(baz';
    expect(pipe.transform(input)).toBe(input);
  });

  it('returns empty string for undefined input', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('handles extremely long C++ template lambda signatures', () => {
    const input = 'std::once_flag::_Prepare_execution::_Prepare_execution<std::call_once<void (std::__future_base::_State_baseV2::*)(std::function<std::unique_ptr<std::__future_base::_Result_base, std::__future_base::_Result_base::_Deleter> ()>*, bool*), std::__future_base::_State_baseV2*, std::function<std::unique_ptr<std::__future_base::_Result_base, std::__future_base::_Result_base::_Deleter> ()>*, bool*>(std::once_flag&, void (std::__future_base::_State_baseV2::*&&)(std::function<std::unique_ptr<std::__future_base::_Result_base, std::__future_base::_Result_base::_Deleter> ()>*, bool*), std::__future_base::_State_baseV2*&&, std::function<std::unique_ptr<std::__future_base::_Result_base, std::__future_base::_Result_base::_Deleter> ()>*&&, bool*&&)::{lambda()#1}>(void (std::__future_base::_State_baseV2::*&)(std::function<std::unique_ptr<std::__future_base::_Result_base, std::__future_base::_Result_base::_Deleter> ()>*, bool*))::{lambda()#1}::operator()() const';
    const expected = 'std::once_flag::_Prepare_execution::_Prepare_execution<...>(...)::{lambda()#1}::operator()() const';
    expect(pipe.transform(input)).toBe(expected);
  });
});
