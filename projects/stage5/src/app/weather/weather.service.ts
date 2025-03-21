import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, signal, WritableSignal } from '@angular/core'
import { firstValueFrom, Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'

import { environment } from '../../environments/environment'
import { ICurrentWeather } from '../interfaces'
import { defaultPostalCode, PostalCodeService } from '../postal-code/postal-code.service'

interface ICurrentWeatherData {
  weather: [
    {
      description: string
      icon: string
    },
  ]
  main: {
    temp: number
  }
  sys: {
    country: string
  }
  dt: number
  name: string
}

export interface IWeatherService {
  readonly currentWeatherSignal: WritableSignal<ICurrentWeather>
  updateCurrentWeatherSignal(search: string, country?: string): Promise<void>
}

export const defaultWeather: ICurrentWeather = {
  city: '--',
  country: '--',
  date: Date.now(),
  image: '',
  temperature: 0,
  description: '',
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService implements IWeatherService {
  readonly currentWeatherSignal = signal(defaultWeather)

  constructor(
    private httpClient: HttpClient,
    private postalCodeService: PostalCodeService
  ) {}

  async updateCurrentWeatherSignal(searchText: string, country?: string): Promise<void> {
    this.currentWeatherSignal.set(
      await this.getCurrentWeatherAsPromise(searchText, country)
    )
  }

  private getCurrentWeather(
    searchText: string,
    country?: string
  ): Observable<ICurrentWeather> {
    return this.postalCodeService.resolvePostalCode(searchText).pipe(
      switchMap((postalCode) => {
        if (postalCode && postalCode !== defaultPostalCode) {
          return this.getCurrentWeatherByCoords({
            latitude: postalCode.lat,
            longitude: postalCode.lng,
          } as GeolocationCoordinates)
        } else {
          const uriParams = new HttpParams().set(
            'q',
            country ? `${searchText},${country}` : searchText
          )
          return this.getCurrentWeatherHelper(uriParams)
        }
      })
    )
  }

  private getCurrentWeatherByCoords(
    coords: GeolocationCoordinates
  ): Observable<ICurrentWeather> {
    const uriParams = new HttpParams()
      .set('lat', coords.latitude.toString())
      .set('lon', coords.longitude.toString())

    return this.getCurrentWeatherHelper(uriParams)
  }

  private getCurrentWeatherAsPromise(
    searchText: string,
    country?: string
  ): Promise<ICurrentWeather> {
    return firstValueFrom(this.getCurrentWeather(searchText, country))
  }

  private transformToICurrentWeather(data: ICurrentWeatherData): ICurrentWeather {
    return {
      city: data.name,
      country: data.sys.country,
      date: data.dt * 1000,
      image: `http://openweathermap.org/img/w/${data.weather[0].icon}.png`,
      temperature: this.convertKelvinToFahrenheit(data.main.temp),
      description: data.weather[0].description,
    }
  }

  private convertKelvinToFahrenheit(kelvin: number): number {
    return (kelvin * 9) / 5 - 459.67
  }

  private getCurrentWeatherHelper(uriParams: HttpParams): Observable<ICurrentWeather> {
    uriParams = uriParams.set('appid', environment.appId)

    return this.httpClient
      .get<ICurrentWeatherData>(
        `${environment.baseUrl}api.openweathermap.org/data/2.5/weather`,
        { params: uriParams }
      )
      .pipe(map((data) => this.transformToICurrentWeather(data)))
  }
}
