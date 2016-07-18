check "phys-math":
  A = 20
  B = 5
  C = 17
  m = 4
  n = 3
  b = 5
  k = -3
  A0 = 9
  proportional = lam(x):
    A * x
  end
  linear = lam(x):
    (m * x) + b
  end
  quadratic = lam(x):
    (A * x * x) + (B * x) + C
  end
  inverse = lam(x):
    A / x
  end
  inverse-square = lam(x):
    A / (x * x)
  end
  root = lam(x):
    num-expt(x, n)
  end
  decay = lam(x):
    A0 * num-exp(k * x)
  end
  trig = lam(x): 
    num-sin(x)
  end

  proportional(1) is%(within-abs(~0.01)) 20
  linear(1) is%(within-abs(~0.01)) 9
  quadratic(1) is%(within-abs(~0.01)) 42
  inverse(1) is%(within-abs(~0.01)) 20
  inverse-square(1) is%(within-abs(~0.01)) 20
  root(1) is%(within-abs(~0.01)) 1
  decay(1) is%(within-abs(~0.01)) 0.45
  trig(1) is%(within-abs(~0.01)) 0.84

  proportional(2) is%(within-abs(~0.01)) 40
  linear(2) is%(within-abs(~0.01)) 13
  quadratic(2) is%(within-abs(~0.01)) 107
  inverse(2) is%(within-abs(~0.01)) 10
  inverse-square(2) is%(within-abs(~0.01)) 5
  root(2) is%(within-abs(~0.01)) 8
  decay(2) is%(within-abs(~0.001)) 0.022
  trig(2) is%(within-abs(~0.01)) 0.91

  proportional(3) is%(within-abs(~0.01)) 60
  linear(3) is%(within-abs(~0.01)) 17
  quadratic(3) is%(within-abs(~0.01)) 212
  inverse(3) is%(within-abs(~0.01)) 20/3
  inverse-square(3) is%(within-abs(~0.01)) 20/9
  root(3) is%(within-abs(~0.01)) 27
  decay(3) is%(within-abs(~0.0001)) 0.0011
  trig(3) is%(within-abs(~0.01)) 0.14

  proportional(4) is%(within-abs(~0.01)) 80
  linear(4) is%(within-abs(~0.01)) 21
  quadratic(4) is%(within-abs(~0.01)) 357
  inverse(4) is%(within-abs(~0.01)) 5
  inverse-square(4) is%(within-abs(~0.01)) 5/4
  root(4) is%(within-abs(~0.01)) 64
  decay(4) is%(within-abs(~1e-05)) 5.5298e-05
  trig(4) is%(within-abs(~0.01)) -0.76

  proportional(5) is%(within-abs(~0.01)) 100
  linear(5) is%(within-abs(~0.01)) 25
  quadratic(5) is%(within-abs(~0.01)) 542
  inverse(5) is%(within-abs(~0.01)) 4
  inverse-square(5) is%(within-abs(~0.01)) 4/5
  root(5) is%(within-abs(~0.01)) 125
  decay(5) is%(within-abs(~1e-06)) 2.7531e-06
  trig(5) is%(within-abs(~0.01)) -0.959

end
