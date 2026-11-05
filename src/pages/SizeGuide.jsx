import Seo from '../components/Seo';

export default function SizeGuide() {
  return (
    <main className="pt-24 pb-16 min-h-[80vh]">
      <Seo
        title="Size Guide"
        path="/size-guide"
        description="Find your perfect fit with our detailed shoe size guide and conversion chart."
      />
      <div className="container-main max-w-3xl">
        <h1 className="text-3xl font-light tracking-tight mb-8">Size Guide</h1>
        <p className="text-neutral-500 mb-8">
          Use the chart below to find your perfect fit. Our shoes are true to size. If you are between sizes, we recommend sizing up.
        </p>

        <div className="overflow-x-auto border border-neutral-100 mb-12">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide text-xs">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">UK Size</th>
                <th scope="col" className="px-6 py-4 font-medium">US Size</th>
                <th scope="col" className="px-6 py-4 font-medium">EU Size</th>
                <th scope="col" className="px-6 py-4 font-medium">Foot Length (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">6</td><td className="px-6 py-4">7</td><td className="px-6 py-4">40</td><td className="px-6 py-4">24.5</td>
              </tr>
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">7</td><td className="px-6 py-4">8</td><td className="px-6 py-4">41</td><td className="px-6 py-4">25.5</td>
              </tr>
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">8</td><td className="px-6 py-4">9</td><td className="px-6 py-4">42</td><td className="px-6 py-4">26.5</td>
              </tr>
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">9</td><td className="px-6 py-4">10</td><td className="px-6 py-4">43</td><td className="px-6 py-4">27.5</td>
              </tr>
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">10</td><td className="px-6 py-4">11</td><td className="px-6 py-4">44</td><td className="px-6 py-4">28.5</td>
              </tr>
              <tr className="hover:bg-neutral-50 transition-base">
                <td className="px-6 py-4">11</td><td className="px-6 py-4">12</td><td className="px-6 py-4">45</td><td className="px-6 py-4">29.5</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h2 className="text-xl font-medium tracking-tight mb-4">How to Measure</h2>
        <ol className="list-decimal pl-5 text-neutral-500 space-y-2">
          <li>Place a piece of paper on the floor against a wall.</li>
          <li>Stand on the paper with your heel against the wall.</li>
          <li>Mark the longest part of your foot on the paper.</li>
          <li>Measure the distance from the edge of the paper to the mark in centimeters.</li>
        </ol>
      </div>
    </main>
  );
}
